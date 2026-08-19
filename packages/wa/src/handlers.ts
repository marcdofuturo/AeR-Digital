// ─── State Machine & Step Handlers ───────────────────────────
import type { Step, Draft, StepHandler, HandlerContext, ResolvedArtist, ProducerRef } from "./types";

// ─── Assign roles (R3: 1-4 primary, 5+ featuring) ────────────
export function assignRoles(names: ResolvedArtist[]): ResolvedArtist[] {
  return names.map((a, i) => ({
    ...a,
    position: i + 1,
    billing_role: (i + 1 <= 4 ? "primary" : "featuring") as "primary" | "featuring",
  }));
}

// ─── Artist name split ──────────────────────────────────────
const RAW_SEPARATORS = /\s*(?:,|;|\/|&|\bfeat\.?\b|\bft\.?\b|\s+e\s+|\s+com\s+)\s*/gi;

export function splitNames(input: string): string[] {
  return input
    .split(RAW_SEPARATORS)
    .map(s => s.replace(/^\d+[\).\-]+\s*/, "").trim())
    .filter(s => s.length >= 1)
    .slice(0, 12);
}

export function parseAudioFilename(input: string): { title: string | null; participants: string[] } {
  const cleaned = input
    .replace(/^\[(?:AUDIO|DOCUMENT)\]\s*/i, "")
    .replace(/\.(wav|wave|mp3|flac|m4a|aac|ogg)$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || cleaned.startsWith("[")) return { title: null, participants: [] };

  const dashParts = cleaned.split(/\s+-\s+/).map(part => part.trim()).filter(Boolean);
  if (dashParts.length >= 2) {
    return {
      participants: splitNames(dashParts[0]!),
      title: dashParts.slice(1).join(" - "),
    };
  }

  return { title: cleaned, participants: [] };
}

export function parseMetadataCorrection(input: string): {
  title: string | null;
  participants: string[];
  roles: Array<{ name: string; role: string }>;
} {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let title: string | null = null;
  let participantText = "";
  let roleText = "";

  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (!match) continue;
    const key = normalizeText(match[1]!);
    const value = match[2]!.trim();
    if (key.startsWith("titulo") || key.startsWith("nome")) title = value;
    if (key.startsWith("participante") || key.startsWith("artista")) participantText = value;
    if (key.startsWith("cargo") || key.startsWith("funcao")) roleText = value;
  }

  return {
    title,
    participants: participantText ? splitNames(participantText) : [],
    roles: roleText
      ? roleText.split(/[;|]/).map((part) => {
          const [name, role] = part.split(/\s+-\s+|\s*:\s*/);
          return { name: (name ?? "").trim(), role: (role ?? "").trim() };
        }).filter((item) => item.name && item.role)
      : [],
  };
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isAffirmative(input: string) {
  const value = normalizeText(input);
  return value === "sim" || value === "ok" || value === "isso" || value === "certo" || value === "enviar" || value === "confirmo";
}

function isNegative(input: string) {
  const value = normalizeText(input);
  return value === "nao" || value === "corrigir" || value.includes("corrige") || value.includes("errado");
}

async function resolveArtists(ctx: HandlerContext, names: string[]) {
  const resolved: ResolvedArtist[] = [];
  for (const name of names) {
    const existing = await ctx.db.findArtist(ctx.tenant_id, name);
    resolved.push(existing ?? await ctx.db.createArtist(ctx.tenant_id, name));
  }
  return assignRoles(resolved);
}

function formatMetadataReview(draft: Draft) {
  const artists = draft.artists ?? [];
  const lines = artists.length
    ? artists.map((artist) => `${artist.position}. ${artist.stage_name} - ${artist.billing_role === "featuring" ? "feat." : "principal"}${artist.is_producer ? " / produtor" : ""}`).join("\n")
    : "Participantes não identificados";

  return [
    "Reconheci estes dados do envio:",
    "",
    `Título: ${draft.title || draft.filename_title_guess || "não identificado"}`,
    "",
    "Participantes e cargos:",
    lines,
    "",
    "Está certo? Responda *SIM* para seguir, ou mande *corrigir* para enviar a lista correta.",
    "Se quiser adicionar alguém, mande *corrigir* e inclua todo mundo na ordem correta.",
  ].join("\n");
}

function correctionPrompt() {
  return [
    "Manda a lista correta neste formato:",
    "",
    "Titulo: Nome da musica",
    "Participantes: Artista 1, Artista 2, Artista 3",
    "Cargos: Artista 1 - principal; Artista 2 - feat; Artista 3 - feat",
    "",
    "Depois eu devolvo a revisão para confirmar. Se precisar corrigir a pergunta anterior, escreva *voltar*.",
  ].join("\n");
}

export async function completeUploadedMedia(
  draft: Draft,
  ctx: HandlerContext,
  media: { audioUrl: string; coverUrl: string; audioFilename: string },
) {
  const filenameInfo = parseAudioFilename(media.audioFilename);
  const artists = filenameInfo.participants.length
    ? await resolveArtists(ctx, filenameInfo.participants)
    : (draft.artists ?? []);
  const nextDraft: Partial<Draft> = {
    audio_url: media.audioUrl,
    cover_url: media.coverUrl,
    audio_filename: media.audioFilename,
    title: filenameInfo.title ?? draft.title,
    artists,
    filename_title_guess: filenameInfo.title ?? draft.filename_title_guess,
    filename_participants_guess: filenameInfo.participants.length
      ? filenameInfo.participants
      : draft.filename_participants_guess,
  };
  const completedDraft = { ...draft, ...nextDraft };

  if (!completedDraft.title || !(completedDraft.artists ?? []).length) {
    return {
      reply: `Arquivos recebidos. Preciso confirmar os dados antes de seguir.\n\n${correctionPrompt()}`,
      nextStep: "ask_metadata_correction" as const,
      draft: nextDraft,
    };
  }

  return {
    reply: formatMetadataReview(completedDraft),
    nextStep: "confirm_file_metadata" as const,
    draft: nextDraft,
  };
}

function finalReview(draft: Draft) {
  const artists = (draft.artists ?? []).map((artist) =>
    `${artist.position}. ${artist.stage_name} - ${artist.billing_role === "featuring" ? "feat." : "principal"}${artist.is_producer ? " / produtor" : ""}`
  ).join("\n");

  return [
    "Revisão do envio:",
    "",
    `Formato: ${draft.release_format === "album" ? `Álbum/EP (${draft.album_track_count ?? 1} faixas)` : "Single"}`,
    `Título: ${draft.title ?? "Sem título"}`,
    `Participantes:\n${artists || "não informados"}`,
    `Produtores: ${(draft.producers ?? []).map((producer) => producer.name).join(", ") || "não informados"}`,
    `Gêneros: ${(draft.genres ?? []).join(" / ") || "não informados"}`,
    `Data de lançamento: ${draft.release_date ?? "a definir"}`,
    `Áudio: ${draft.audio_url ? "recebido" : "pendente"}`,
    `Capa: ${draft.cover_url ? "recebida" : "pendente"}`,
    "",
    "Enviar: responda *ENVIAR* ou *SIM*.",
    "Está tudo certo? Responda *ENVIAR* ou *SIM* para enviar ao painel, ou diga o que quer corrigir.",
  ].join("\n");
}

// ─── Genre list ──────────────────────────────────────────────
export const GENEROS = [
  "Funk", "Trap", "Rap", "Hip Hop", "Pagode", "Samba", "Sertanejo", "Forró",
  "Piseiro", "Arrocha", "Brega Funk", "Funk Mandelão", "Funk Bruxaria",
  "Pop", "MPB", "Rock", "Eletrônica", "House", "Tecno Melody", "Gospel",
  "Reggae", "Axé", "Trap Funk", "Drill", "R&B", "Soul", "Bregadeira",
] as const;

export function matchGenre(input: string): string | null {
  const norm = input.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const g of GENEROS) {
    const gn = g.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (gn === norm || levenshtein(gn, norm) <= 2) return g;
  }
  return null;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i]![j] = a[i - 1] === b[j - 1] ? dp[i - 1]![j - 1]! : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
  return dp[m]![n]!;
}

// ─── Date parser ─────────────────────────────────────────────
function formatReleaseDateForMessage(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  return utcDate.toLocaleDateString("pt-BR", { dateStyle: "full", timeZone: "UTC" });
}

export function parseReleaseDate(input: string): string | null {
  const s = input.trim();
  // dd/mm/yyyy, dd/mm/yy
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const d = parseInt(m[1]!), mo = parseInt(m[2]!) - 1;
    let y = parseInt(m[3]!);
    if (y < 100) y += 2000;
    const dt = new Date(Date.UTC(y, mo, d));
    if (isNaN(dt.getTime())) return null;
    return dt.toISOString().split("T")[0]!;
  }
  // dd/mm (assume next future)
  m = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    const d = parseInt(m[1]!), mo = parseInt(m[2]!) - 1;
    const now = new Date();
    let y = now.getUTCFullYear();
    let dt = new Date(Date.UTC(y, mo, d));
    if (dt <= now) dt = new Date(Date.UTC(++y, mo, d));
    if (isNaN(dt.getTime())) return null;
    return dt.toISOString().split("T")[0]!;
  }
  return null;
}

// ─── Step handlers ──────────────────────────────────────────

export const handlers: Record<Step, StepHandler> = {
  async ask_release_format(input, _draft, _ctx) {
    const norm = input.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (norm.includes("album") || norm.includes("ep")) {
      return {
        reply: "✅ Álbum/EP.\n\nQuantas faixas vão entrar neste envio?\n\nSe precisar corrigir, escreva *voltar*.",
        nextStep: "ask_album_track_count",
        draft: { release_format: "album" },
      };
    }
    if (norm.includes("single") || norm.includes("musica") || norm.includes("faixa") || norm === "1") {
      return {
        reply: "✅ Single.\n\n*2. Envie o áudio.*\nUse o link seguro: WAV PCM, estéreo, 16-bit e 44,1 kHz. Vou tentar reconhecer o título e os participantes pelo nome do arquivo.",
        nextStep: "ask_audio",
        draft: { release_format: "single", album_track_count: 1, current_track_index: 1 },
      };
    }
    return {
      reply: "É *single* ou *álbum/EP*?\n\nResponda com: Single ou Álbum.\n\nSe precisar corrigir, escreva *voltar*.",
      nextStep: "ask_release_format",
      draft: {},
    };
  },

  async ask_album_track_count(input, _draft, _ctx) {
    const count = Number(input.replace(/\D+/g, ""));
    if (!Number.isInteger(count) || count < 1 || count > 60) {
      return {
        reply: "Me diga a quantidade de faixas com um número entre 1 e 60.\n\nSe precisar corrigir, escreva *voltar*.",
        nextStep: "ask_album_track_count",
        draft: {},
      };
    }
    return {
      reply: `✅ ${count} faixa${count > 1 ? "s" : ""}.\n\n*2. Envie o áudio da faixa 1.*\nUse o link seguro: WAV PCM, estéreo, 16-bit e 44,1 kHz. Vou tentar reconhecer título e participantes pelo nome do arquivo.`,
      nextStep: "ask_audio",
      draft: { album_track_count: count, current_track_index: 1 },
    };
  },

  async ask_title(input, _draft, _ctx) {
    const title = input.trim();
    return {
      reply: `✅ *${title}*\n\n*2. Quais artistas participam? Manda na ordem que vai aparecer no título, separando por vírgula.*\n\nEx: MC GH, MC Jacaré, Mucilon`,
      nextStep: "ask_artists",
      draft: { title },
    };
  },

  async ask_artists(input, draft, ctx) {
    const names = splitNames(input);
    if (names.length === 0) {
      return { reply: "Não entendi. Manda os nomes separados por vírgula.", nextStep: "ask_artists", draft: {} };
    }

    const resolved: ResolvedArtist[] = [];
    for (const name of names) {
      const existing = await ctx.db.findArtist(ctx.tenant_id, name);
      if (existing) {
        resolved.push(existing);
      } else {
        const created = await ctx.db.createArtist(ctx.tenant_id, name);
        resolved.push(created);
      }
    }

    const positioned = assignRoles(resolved);

    const lines = positioned.map((a, i) =>
      `${i + 1}. ${a.stage_name}${a.match_score < 0.90 ? " ⚠️" : ""}`
    ).join("\n");

    return {
      reply: `✅ Anotado:\n${lines}\n\n*3. Quem produziu a música?*\nSe for alguém que já tá na lista, é só falar o nome.`,
      nextStep: "ask_producers",
      draft: { artists: positioned },
    };
  },

  async confirm_file_metadata(input, draft, _ctx) {
    if (isAffirmative(input)) {
      return {
        reply: "✅ Metadados confirmados.\n\n*4. Quem produziu a música?*\nSe o produtor já estiver na lista, é só falar o nome.",
        nextStep: "ask_producers",
        draft: {},
      };
    }

    if (isNegative(input) || input.trim()) {
      return {
        reply: correctionPrompt(),
        nextStep: "ask_metadata_correction",
        draft: {},
      };
    }

    return {
      reply: `${formatMetadataReview(draft)}\n\nResponda *SIM* ou *corrigir*.`,
      nextStep: "confirm_file_metadata",
      draft: {},
    };
  },

  async ask_metadata_correction(input, _draft, ctx) {
    const parsed = parseMetadataCorrection(input);
    if (!parsed.title || parsed.participants.length === 0) {
      return {
        reply: correctionPrompt(),
        nextStep: "ask_metadata_correction",
        draft: {},
      };
    }

    const artists = await resolveArtists(ctx, parsed.participants);
    for (const role of parsed.roles) {
      const found = artists.find((artist) => normalizeText(artist.stage_name) === normalizeText(role.name));
      if (!found) continue;
      const normalizedRole = normalizeText(role.role);
      found.billing_role = normalizedRole.includes("feat") ? "featuring" : "primary";
      found.is_producer = normalizedRole.includes("prod");
    }

    const nextDraft = { title: parsed.title, artists, metadata_roles: parsed.roles };
    return {
      reply: formatMetadataReview(nextDraft),
      nextStep: "confirm_file_metadata",
      draft: nextDraft,
    };
  },

  async ask_producers(input, draft, ctx) {
    const names = splitNames(input);
    const artists = draft.artists ?? [];
    const producers: ProducerRef[] = [];
    const externalNames: string[] = [];
    const nextArtists = artists.map((artist) => ({ ...artist }));

    for (const name of names) {
      const found = nextArtists.find(a => normalizeText(a.stage_name) === normalizeText(name));
      if (found) {
        producers.push({ name, artist_id: found.id, position: found.position });
        found.is_producer = true;
      } else {
        const existing = await ctx.db.findArtist(ctx.tenant_id, name);
        const created = existing ?? await ctx.db.createArtist(ctx.tenant_id, name);
        const producerArtist = {
          ...created,
          position: nextArtists.length + 1,
          billing_role: (nextArtists.length + 1 <= 4 ? "primary" : "featuring") as "primary" | "featuring",
          is_producer: true,
          is_composer: true,
          is_performer: false,
          hidden_from_billing: false,
        };
        nextArtists.push(producerArtist);
        producers.push({ name, artist_id: producerArtist.id, position: producerArtist.position });
        externalNames.push(name);
      }
    }

    if (externalNames.length > 0) {
      return {
        reply: [
          `Incluí ${externalNames.map((name) => `*${name}*`).join(", ")} como produtor na lista:`,
          "",
          nextArtists.map((artist) => `${artist.position}. ${artist.stage_name} - ${artist.billing_role === "featuring" ? "feat." : "principal"}${artist.is_producer ? " / produtor" : ""}`).join("\n"),
          "",
          "confirma essa lista? Responda *SIM* para seguir ou *corrigir* para reenviar título/participantes.",
        ].join("\n"),
        nextStep: "confirm_external_producer",
        draft: { artists: nextArtists, producers, pending_external_producers: externalNames },
      };
    }

    return {
      reply: "✅ Anotado!\n\n*4. Quais os gêneros da música?* Pode escolher até 2.\nEx: Funk, Trap",
      nextStep: "ask_genres",
      draft: { artists: nextArtists, producers },
    };
  },

  async confirm_external_producer(input, _draft, _ctx) {
    if (isAffirmative(input)) {
      return {
        reply: "✅ Produtores confirmados!\n\n*5. Quais gêneros da música?* Pode escolher até 2.\nEx: Funk, Trap",
        nextStep: "ask_genres",
        draft: { pending_external_producers: undefined },
      };
    }

    return {
      reply: correctionPrompt(),
      nextStep: "ask_metadata_correction",
      draft: { pending_external_producers: undefined },
    };
  },

  async ask_producer_position(input, draft, _ctx) {
    const producers = draft.producers ?? [];
    const idx = draft.producer_position_index ?? 0;
    const unresolved = producers.filter(p => !p.artist_id && p.position === undefined);
    const current = unresolved[idx];

    if (!current) {
      return {
        reply: "✅ Produtores anotados!\n\n*4. Quais os gêneros da música?* Pode escolher até 2.\nEx: Funk, Trap",
        nextStep: "ask_genres",
        draft: { producers, producer_position_index: undefined },
      };
    }

    const u = input.trim().toUpperCase();
    const artists = draft.artists ?? [];

    if (u === "NÃO" || u === "NAO" || u === "N") {
      current.hidden_from_billing = true;
      current.position = artists.length + 1;

      const next = unresolved[idx + 1];
      if (next) {
        return {
          reply: `OK! E o *${next.name}*? Em que posição ele entra?\n\nResponde o número ou *NÃO*.`,
          nextStep: "ask_producer_position",
          draft: { producers: [...producers], producer_position_index: idx + 1 },
        };
      }

      return {
        reply: "✅ Produtores anotados!\n\n*4. Quais os gêneros da música?* Pode escolher até 2.\nEx: Funk, Trap",
        nextStep: "ask_genres",
        draft: { producers: [...producers], producer_position_index: undefined },
      };
    }

    const pos = parseInt(input);
    if (pos >= 1 && pos <= artists.length + 1) {
      current.position = pos;
      current.hidden_from_billing = false;

      const next = unresolved[idx + 1];
      if (next) {
        return {
          reply: `Posição ${pos} para *${current.name}*.\nE o *${next.name}*? Em que posição entra?`,
          nextStep: "ask_producer_position",
          draft: { producers: [...producers], producer_position_index: idx + 1 },
        };
      }

      return {
        reply: "✅ Produtores anotados!\n\n*4. Quais os gêneros da música?* Pode escolher até 2.\nEx: Funk, Trap",
        nextStep: "ask_genres",
        draft: { producers: [...producers], producer_position_index: undefined },
      };
    }

    return {
      reply: `Responde um número de 1 a ${artists.length + 1}, ou *NÃO*.`,
      nextStep: "ask_producer_position",
      draft: {},
    };
  },

  async ask_genres(input, _draft, _ctx) {
    const genres = input.split(/[,;\/]/).map(s => s.trim()).filter(Boolean);
    const matched: string[] = [];
    for (const g of genres) {
      const m = matchGenre(g);
      if (m && !matched.includes(m)) matched.push(m);
    }
    const selected = matched.slice(0, 2);

    if (selected.length === 0) {
      const opts = GENEROS.slice(0, 6);
      return {
        reply: `Não reconheci. Escolhe até 2:\n${opts.map((g,i) => `${i+1}. ${g}`).join("\n")}`,
        nextStep: "ask_genres",
        draft: {},
      };
    }

    return {
      reply: `✅ ${selected.join(" · ")}\n\n*6. Qual a data de lançamento?*\nPode mandar tipo 06/03 ou 06/03/2027.`,
      nextStep: "ask_date",
      draft: { genres: selected },
    };
  },

  async ask_date(input, _draft, _ctx) {
    const date = parseReleaseDate(input);

    if (!date) {
      return {
        reply: "Não entendi a data. Manda tipo 06/03/2027 ou 06/03.",
        nextStep: "ask_date",
        draft: {},
      };
    }

    // Check if past
    const d = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const urgent = (d.getTime() - today.getTime()) < 3 * 86400000;

    const nextDraft = { release_date: date, urgent };
    const displayDate = formatReleaseDateForMessage(date);
    return {
      reply: `✅ ${displayDate}\n\n${finalReview({ ..._draft, ...nextDraft })}`,
      nextStep: "confirm",
      draft: { release_date: date, urgent },
    };
  },

  async ask_audio(input, _draft, ctx) {
    const media = ctx.incomingMedia?.kind === "audio" ? ctx.incomingMedia : null;
    const audioFilename = media?.fileName ?? input;
    const filenameInfo = parseAudioFilename(audioFilename);
    const artists = filenameInfo.participants.length
      ? await resolveArtists(ctx, filenameInfo.participants)
      : [];

    return {
      reply: "Perfeito! 🎧\n\n*3. Envie a capa.*\nManda como *ARQUIVO/DOCUMENTO* no clipe, não como foto, para manter a qualidade.\n\nQuadrada, entre 1600x1600 e 3000x3000px.",
      nextStep: "ask_cover",
      draft: {
        audio_url: media?.url ?? "received",
        audio_filename: audioFilename,
        title: filenameInfo.title ?? undefined,
        artists,
        filename_title_guess: filenameInfo.title ?? undefined,
        filename_participants_guess: filenameInfo.participants,
      },
    };
  },

  async ask_cover(_input, draft, _ctx) {
    const media = _ctx.incomingMedia?.kind === "image" ? _ctx.incomingMedia : null;
    const nextDraft = { cover_url: media?.url ?? "received" };
    if (!draft.title || !(draft.artists ?? []).length) {
      return {
        reply: `Capa recebida. Preciso confirmar os dados antes de seguir.\n\n${correctionPrompt()}`,
        nextStep: "ask_metadata_correction",
        draft: nextDraft,
      };
    }
    return {
      reply: formatMetadataReview({ ...draft, ...nextDraft }),
      nextStep: "confirm_file_metadata",
      draft: nextDraft,
    };
  },

  async confirm(input, draft, ctx) {
    if (isAffirmative(input) || input.trim() === "👍") {
      // Create release via DB
      try {
        await ctx.db.createRelease({
          tenantId: ctx.tenant_id,
          title: draft.title ?? "Sem título",
          releaseDate: draft.release_date ?? new Date().toISOString().split("T")[0]!,
          genres: draft.genres ?? [],
          audioUrl: draft.audio_url,
          coverUrl: draft.cover_url,
          participants: draft.artists ?? [],
          producers: draft.producers ?? [],
        });
      } catch (err) {
        console.error("Failed to create WhatsApp release:", err);
        return {
          reply: "Nao consegui salvar esse envio no painel agora. Ja fiquei com a revisao aberta; responda *ENVIAR* de novo em alguns minutos ou chame o time da Audiolink.",
          nextStep: "confirm",
          draft: {},
        };
      }

      return {
        reply: `Fechou! 🎉\n\nO time do ${ctx.tenant_name} já recebeu. Se precisar de algo, te chamamos por aqui.`,
        nextStep: "done",
        draft: {},
      };
    }

    // Heuristic: which step to reopen
    const t = normalizeText(input);
    if (t.includes("ordem") || t.includes("nome") || t.includes("artista") || t.includes("credito"))
      return { reply: correctionPrompt(), nextStep: "ask_metadata_correction", draft: {} };
    if (t.includes("data") || t.includes("lancamento"))
      return { reply: "Certo! Qual a data correta?", nextStep: "ask_date", draft: {} };
    if (t.includes("genero") || t.includes("estilo") || t.includes("categoria"))
      return { reply: "Quais os gêneros corretos?", nextStep: "ask_genres", draft: {} };
    if (t.includes("titulo") || t.includes("nome da musica") || t.includes("musica"))
      return { reply: correctionPrompt(), nextStep: "ask_metadata_correction", draft: {} };
    if (t.includes("produtor"))
      return { reply: "Quem produziu a música?", nextStep: "ask_producers", draft: {} };

    return { reply: "Não entendi. Responde *SIM* para enviar, ou me fala o que precisa mudar.", nextStep: "confirm", draft: {} };
  },

  async done(_input, _draft, _ctx) {
    return { reply: "", nextStep: "done", draft: {} };
  },
};
