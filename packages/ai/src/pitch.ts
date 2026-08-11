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
        Authorization: "Basic " + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64"),
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
    const data = await this.fetch(`search?q=${encodeURIComponent(query)}&type=artist&market=${country}&limit=1`);
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

export function buildPitchPrompt(ctx: PitchContext): string {
  const audienceText = ctx.artistAudiences
    .map(a => `${a.name}: ${a.followers.toLocaleString("pt-BR")} seguidores · ${a.genres.join("/")} · pop ${a.popularity} · relacionados: ${a.related.join(", ")}`)
    .join("\n");

  return `Você escreve pitches para playlists editoriais brasileiras.
Escreve para um curador que lê 200 pitches por dia.

FAIXA: ${ctx.titulo} · ${ctx.creditos} · ${ctx.generos.join(" / ")} · lança ${ctx.data}
SINAL: ${ctx.bpm} BPM · tom ${ctx.key} · energia ${ctx.energy.toFixed(2)}/1.0 · gancho aos ${ctx.hook_at_sec}s
LETRA (trecho): ${ctx.transcript_sample}
AUDIÊNCIA:\n${audienceText}
CATÁLOGO SIMILAR: ${ctx.catalogSimilar.join(", ") || "nenhum"}

REGRAS
- Máx. 500 caracteres por opção (limite do Spotify for Artists).
- Português brasileiro, direto. Zero adjetivo vazio ("incrível", "imperdível", "sensação"). Curador ignora hype.
- Inclua: o que a faixa É sonoramente · por que agora · prova de tração se houver.
- NUNCA invente streams, playlist, prêmio ou parceria.

DUAS OPÇÕES, ÂNGULOS DIFERENTES
A) SONORO — produção, referências, encaixe de playlist
B) NARRATIVO — momento do artista, cena, audiência

JSON: {"opcao_a":str,"opcao_b":str,"angulo_a":str,"angulo_b":str,
       "playlists_sugeridas":[str],"avisos":[str]}`;
}

/** Elegibility check */
export function isEligibleForPitch(releaseDate: string, createdDate: string, minLeadDays: number): boolean {
  const release = new Date(releaseDate);
  const created = new Date(createdDate);
  const diffDays = (release.getTime() - created.getTime()) / 86400000;
  return diffDays >= minLeadDays;
}
