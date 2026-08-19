export const PRESENTATION_SOURCE_DISPLAY_LIMIT = 12;

export type PresentationSource = {
  titulo: string;
  url: string;
};

export function summarizePresentationSources(value: unknown): {
  visible: PresentationSource[];
  total: number;
} {
  if (!Array.isArray(value)) return { visible: [], total: 0 };

  const unique = new Map<string, PresentationSource>();
  for (const source of value) {
    if (!source || typeof source !== "object") continue;
    const titulo = String((source as { titulo?: unknown }).titulo ?? "").trim();
    const url = String((source as { url?: unknown }).url ?? "").trim();
    if (!titulo || !/^https:\/\//i.test(url) || unique.has(url)) continue;
    unique.set(url, { titulo, url });
  }

  const sources = [...unique.values()];
  return {
    visible: sources.slice(0, PRESENTATION_SOURCE_DISPLAY_LIMIT),
    total: sources.length,
  };
}
