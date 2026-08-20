export function formatTrackDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return "";
  const totalSeconds = Math.max(0, Math.floor(Number(seconds)));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function parseTrackDuration(value: FormDataEntryValue | string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const match = /^(\d+):([0-5]\d)$/.exec(text);
  if (!match) throw new Error("Duracao invalida. Use o formato MM:SS");

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const total = minutes * 60 + seconds;
  if (!Number.isSafeInteger(total) || total > 86_400) {
    throw new Error("Duracao invalida");
  }
  return total;
}
