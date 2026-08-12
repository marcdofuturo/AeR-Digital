// ─── State Machine & Step Handlers ───────────────────────────
import type { Step, Draft, StepResult, StepHandler, HandlerContext, ResolvedArtist, ProducerRef } from "./types";

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
        reply: "✅ Single.\n\n*1. Qual o nome da música?*\n\nSe precisar corrigir, escreva *voltar*.",
        nextStep: "ask_title",
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
      reply: `✅ ${count} faixa${count > 1 ? "s" : ""}.\n\n*1. Qual o nome da primeira música?*\n\nSe precisar corrigir, escreva *voltar*.`,
      nextStep: "ask_title",
      draft: { album_track_count: count, current_track_index: 1 },
    };
  },

  async ask_title(input, _draft, ctx) {
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

  async ask_producers(input, draft, ctx) {
    const names = splitNames(input);
    const artists = draft.artists ?? [];
    const producers: ProducerRef[] = [];
    const unresolved: string[] = [];

    for (const name of names) {
      const found = artists.find(a => a.stage_name.toLowerCase().normalize("NFD") === name.toLowerCase().normalize("NFD"));
      if (found) {
        producers.push({ name, artist_id: found.id, position: found.position });
        // Mark as producer
        found.is_producer = true;
      } else {
        producers.push({ name });
        unresolved.push(name);
      }
    }

    if (unresolved.length > 0) {
      const next = unresolved[0]!;
      return {
        reply: `O *${next}* produziu mas não tá na lista de artistas.\n\nEm que posição ele entra nos créditos?\n\n${artists.map((a,i) => `${i+1}. ${a.stage_name}`).join("\n")}\n\nResponde só o número (ex: 3), ou *NÃO* se ele não deve aparecer no título.`,
        nextStep: "ask_producer_position",
        draft: { producers, producer_position_index: 0 },
      };
    }

    return {
      reply: "✅ Anotado!\n\n*4. Quais os gêneros da música?* Pode escolher até 2.\nEx: Funk, Trap",
      nextStep: "ask_genres",
      draft: { producers },
    };
  },

  async ask_producer_position(input, draft, ctx) {
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
      reply: `✅ ${selected.join(" · ")}\n\n*5. Qual a data de lançamento?*\nPode mandar tipo 06/03 ou "dia 6 de março".`,
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

    return {
      reply: `✅ ${d.toLocaleDateString("pt-BR", { dateStyle: "full" })}\n\nAgora manda o *áudio* da música. 🎧\nWAV ou MP3 320kbps.`,
      nextStep: "ask_audio",
      draft: { release_date: date, urgent },
    };
  },

  async ask_audio(input, _draft, _ctx) {
    const filenameInfo = parseAudioFilename(input);
    const suggestion = filenameInfo.title
      ? `\n\nPelo nome do arquivo, identifiquei:\n*Nome:* ${filenameInfo.title}\n*Participantes:* ${filenameInfo.participants.join(", ") || "não identificado"}\n\nSe estiver diferente, responda em lista:\nNome: ...\nParticipantes: Artista 1, Artista 2\nCargos: Artista 1 - intérprete; Artista 2 - produtor`
      : "";

    return {
      reply: `Perfeito! 🎧${suggestion}\n\nAgora a *capa*. Manda como *ARQUIVO/DOCUMENTO* (no clipe 📎 → Documento), não como foto — senão o WhatsApp estraga a qualidade.\n\nMínimo 3000x3000px, quadrada.`,
      nextStep: "ask_cover",
      draft: {
        audio_url: "received",
        audio_filename: input,
        filename_title_guess: filenameInfo.title ?? undefined,
        filename_participants_guess: filenameInfo.participants,
      },
    };
  },

  async ask_cover(_input, draft, ctx) {
    const artists = draft.artists ?? [];
    const creditLines = artists.map((a, i) =>
      `${i + 1}. ${a.stage_name} — ${a.billing_role === "featuring" ? "Participação (feat.)" : "Artista principal"}${a.is_producer ? " · Produção" : ""}`
    ).join("\n");

    const displayArtists = artists.map(a => a.stage_name);
    const featLine = displayArtists.slice(0, 3).join(", ") + (displayArtists.length > 3 ? ` & ${displayArtists[displayArtists.length - 1]}` : "");

    return {
      reply: `Confere se tá tudo certo? ✅\n\n🎵 *${draft.title?.toUpperCase()}*\n📅 ${draft.release_date}\n🎼 ${(draft.genres ?? []).join(" · ")}\n\n*Créditos:*\n${creditLines}\n\n*Vai sair assim:*\n${featLine} — ${draft.title}\n\n🎧 Áudio ✅\n🖼️ Capa ✅\n\nTá certo? Responde *SIM*.`,
      nextStep: "confirm",
      draft: { cover_url: "received" },
    };
  },

  async confirm(input, draft, ctx) {
    const u = input.trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (u === "SIM" || u === "OK" || input.trim() === "👍" || u === "ISSO" || u === "CERTO") {
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
      } catch {
        // DB ops handled by higher layer
      }

      return {
        reply: `Fechou! 🎉\n\nO time do ${ctx.tenant_name} já recebeu. Se precisar de algo, te chamamos por aqui.`,
        nextStep: "done",
        draft: {},
      };
    }

    // Heuristic: which step to reopen
    const t = input.toLowerCase();
    if (t.includes("ordem") || t.includes("nome") || t.includes("artista") || t.includes("crédito"))
      return { reply: "Ok! Manda os artistas de novo, na ordem certa.", nextStep: "ask_artists", draft: {} };
    if (t.includes("data") || t.includes("lançamento"))
      return { reply: "Certo! Qual a data correta?", nextStep: "ask_date", draft: {} };
    if (t.includes("gênero") || t.includes("estilo") || t.includes("categoria"))
      return { reply: "Quais os gêneros corretos?", nextStep: "ask_genres", draft: {} };
    if (t.includes("título") || t.includes("nome da música") || t.includes("música"))
      return { reply: "Qual o nome correto da música?", nextStep: "ask_title", draft: {} };

    return { reply: "Não entendi. Responde *SIM* se estiver certo, ou me fala o que precisa mudar.", nextStep: "confirm", draft: {} };
  },

  async done(_input, _draft, _ctx) {
    return { reply: "", nextStep: "done", draft: {} };
  },
};
