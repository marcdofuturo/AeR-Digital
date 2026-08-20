// ─── Prompt 6 — Pitch Agent Pipeline ───────────────────────
// Packages/ai integration: Spotify API + Claude synthesis

// ─── Spotify Client (Client Credentials) ────────────────────

export interface SpotifyArtist {
  id: string;
  name: string;
  followers: number;
  genres: string[];
  popularity: number;
  url: string;
  image_url?: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  popularity: number;
  preview_url?: string;
}

export interface AudioFeatures {
  danceability: number;
  energy: number;
  key: number;
  loudness: number;
  mode: number;
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
  tempo: number;
}

export class SpotifyClient {
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(
    private clientId: string,
    private clientSecret: string,
  ) {}

  private async ensureToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64"),
      },
      body: "grant_type=client_credentials",
    });

    const data = await res.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in ?? 3600) * 1000;
    return this.accessToken!;
  }

  private async fetch(path: string): Promise<any> {
    const token = await this.ensureToken();
    const res = await fetch(`https://api.spotify.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  }

  async searchArtist(query: string, country = "BR"): Promise<SpotifyArtist | null> {
    const data = await this.fetch(
      `search?q=${encodeURIComponent(query)}&type=artist&market=${country}&limit=1`,
    );
    const item = data.artists?.items?.[0];
    if (!item) return null;

    return {
      id: item.id,
      name: item.name,
      followers: item.followers?.total ?? 0,
      genres: item.genres ?? [],
      popularity: item.popularity ?? 0,
      url: item.external_urls?.spotify ?? "",
      image_url: item.images?.[0]?.url,
    };
  }

  async getTopTracks(artistId: string, country = "BR"): Promise<SpotifyTrack[]> {
    const data = await this.fetch(`artists/${artistId}/top-tracks?market=${country}`);
    return (data.tracks ?? []).map((t: any) => ({
      id: t.id,
      name: t.name,
      popularity: t.popularity ?? 0,
      preview_url: t.preview_url,
    }));
  }

  async getRelatedArtists(artistId: string): Promise<SpotifyArtist[]> {
    const data = await this.fetch(`artists/${artistId}/related-artists`);
    return (data.artists ?? []).slice(0, 5).map((a: any) => ({
      id: a.id,
      name: a.name,
      followers: a.followers?.total ?? 0,
      genres: a.genres ?? [],
      popularity: a.popularity ?? 0,
      url: a.external_urls?.spotify ?? "",
      image_url: a.images?.[0]?.url,
    }));
  }

  async getAudioFeatures(trackId: string): Promise<AudioFeatures> {
    return this.fetch(`audio-features/${trackId}`);
  }
}

// ─── Audio Analysis Types ───────────────────────────────────

export interface AudioAnalysis {
  transcript: string;
  segments: Array<{ start: number; end: number; text: string }>;
  bpm: number;
  key: string;
  mode: "major" | "minor";
  energy: number; // 0–1
  brightness: number; // 0–1
  duration: number; // seconds
  hook_at_sec: number;
}

// ─── Pitch Generator ────────────────────────────────────────

export interface PitchContext {
  titulo: string;
  creditos: string;
  generos: string[];
  data: string; // ISO
  bpm: number;
  key: string;
  energy: number;
  hook_at_sec: number;
  transcript_sample: string; // first 500 chars
  artistAudiences: Array<{
    name: string;
    followers: number;
    genres: string[];
    popularity: number;
    related: string[];
  }>;
  catalogSimilar: string[];
}

export interface PitchResult {
  opcao_a: string;
  opcao_b: string;
  angulo_a: string;
  angulo_b: string;
  playlists_sugeridas: string[];
  avisos: string[];
}

export interface PresentationContext {
  titulo: string;
  creditos: string;
  generos: string[];
  data: string;
  bpm: number | null;
  key: string | null;
  energy: number | null;
  transcript_sample: string;
  userGuidance?: string | null;
}

export function buildPitchPrompt(ctx: PitchContext): string {
  const audienceText = ctx.artistAudiences
    .map(
      (a) =>
        `${a.name}: ${a.followers.toLocaleString("pt-BR")} seguidores · ${a.genres.join("/")} · pop ${a.popularity} · relacionados: ${a.related.join(", ")}`,
    )
    .join("\n");

  return `Você escreve pitches para playlists editoriais brasileiras.
Escreve para um curador que lê 200 pitches por dia.

FAIXA: ${ctx.titulo} · ${ctx.creditos} · ${ctx.generos.join(" / ")} · lança ${ctx.data}
LETRA (trecho): ${ctx.transcript_sample}
AUDIÊNCIA:\n${audienceText}
CATÁLOGO SIMILAR: ${ctx.catalogSimilar.join(", ") || "nenhum"}

REGRAS
- Máx. 500 caracteres por opção (limite do Spotify for Artists).
- Português brasileiro, direto. Zero adjetivo vazio ("incrível", "imperdível", "sensação"). Curador ignora hype.
- Entenda o contexto, o tema e o sentimento da letra; conecte isso à relevância editorial e à prova de tração, quando houver.
- Não exponha dados técnicos do áudio, pontuações ou métricas internas de análise.
- Não cite nomes de playlists; playlists_sugeridas deve ser sempre uma lista vazia.
- NUNCA invente streams, playlist, prêmio ou parceria.

DUAS OPÇÕES, ÂNGULOS DIFERENTES
A) SONORO — produção, referências e impacto editorial
B) NARRATIVO — momento do artista, cena, audiência

JSON: {"opcao_a":str,"opcao_b":str,"angulo_a":str,"angulo_b":str,
       "playlists_sugeridas":[str],"avisos":[str]}`;
}

export function buildPresentationPrompt(ctx: PresentationContext): string {
  const improvement = ctx.userGuidance?.trim()
    ? `\nPEDIDO DO USUARIO PARA ESTA VERSAO:\n${ctx.userGuidance.trim()}\n`
    : "";

  return `Voce escreve pitching comercial de alto nivel para lancamentos brasileiros.
Gere UMA apresentação persuasiva, concreta e pronta para vender a faixa a equipes editoriais.

FAIXA: ${ctx.titulo}
CREDITOS: ${ctx.creditos}
GENEROS: ${ctx.generos.join(" / ") || "nao informado"}
DATA DE LANCAMENTO: ${ctx.data}
TRECHO/LETRA: ${ctx.transcript_sample || "nao informado"}
${improvement}
REGRAS
- Escreva para um curador com pouco tempo e convença pela especificidade, nao por adjetivos vazios.
- Antes de escrever, pesquise cada artista citado. Use somente relevancia publica ou tracao sustentada por fontes verificaveis.
- Use a TRANSCRICAO COMPLETA para entender o contexto da letra, tema, narrativa, mood/sentimento e imagens centrais; nao copie versos longos.
- Siga o padrao observado em 322 pitchings da Audiolink, cuja mediana e 432 caracteres: abra com faixa e artistas, situe genero ou cena, conecte tema e mood a voz, beat, instrumentacao ou gancho perceptivel e feche com relevancia editorial e potencial de circulacao.
- Organize o texto em 3 ou 4 frases fluidas. A primeira apresenta o gancho; as seguintes desenvolvem tema, mood e sonoridade; a ultima vende a relevancia editorial.
- Use relevancia de carreira, audiencia e tracao somente quando houver fato verificavel. Sem prova, concentre-se na faixa e nunca sinalize falta de dados.
- Explique por que a faixa merece atencao editorial e pode conquistar ouvintes, sem pedir inclusao nem citar uma playlist especifica.
- Nunca exponha dados tecnicos do audio, nota musical, BPM, tom, tonalidade, pontuacoes ou metricas internas de analise.
- Inclua contexto cultural, cidade ou territorio apenas quando confirmado pela pesquisa ou pelos dados fornecidos.
- Para letras explicitas, venda ritmo, interpretacao, irreverencia, atmosfera e impacto cultural sem reproduzir trechos graficos.
- Nao mencione violencia, coercao, risco juridico, classificacao etaria ou recomendacoes negativas no pitching; concentre-se em atributos musicais verdadeiros e comercialmente relevantes.
- Nao cite nomes de playlists, plataformas, lojas, fontes, links ou observacoes.
- Nao inclua avisos, ressalvas, notas metodologicas ou explicacoes sobre falta de dados.
- Nao invente streams, seguidores, premios, imprensa, campanhas, parcerias ou numeros.
- Portugues brasileiro natural, assertivo e sem hype vazio.
- Maximo de 500 caracteres, contando espacos. Entregue preferencialmente entre 380 e 500 caracteres, proximo da referencia de 431 caracteres.
- FORMATO JSON estrito: {"apresentacao":str}`;
}

/** Elegibility check */
export function isEligibleForPitch(
  releaseDate: string,
  createdDate: string,
  minLeadDays: number,
): boolean {
  const release = new Date(releaseDate);
  const created = new Date(createdDate);
  const diffDays = (release.getTime() - created.getTime()) / 86400000;
  return diffDays >= minLeadDays;
}
