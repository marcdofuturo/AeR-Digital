type EvolutionKey = {
  id?: string;
  fromMe?: boolean;
  remoteJid?: string;
  remoteJidAlt?: string;
};

type EvolutionMedia = {
  caption?: string;
  fileName?: string;
  mimetype?: string;
  mimeType?: string;
  url?: string;
};

export type IncomingEvolutionMessage = {
  phone: string;
  text: string;
  fromMe: boolean;
  mediaKind: "audio" | "image" | "text";
  mediaUrl: string | null;
  fileName: string | null;
  messageId: string | null;
  mimeType: string | null;
};

export function extractIncomingEvolutionMessage(data: Record<string, unknown>): IncomingEvolutionMessage | null {
  const key = data.key as EvolutionKey | undefined;
  const rawJid = key?.remoteJidAlt ?? key?.remoteJid ?? "";
  const phone = rawJid.split("@")[0] ?? rawJid;
  if (!phone) return null;

  const msg = (data.message ?? {}) as Record<string, unknown>;
  const directDocument = msg.documentMessage as EvolutionMedia | undefined;
  const wrappedDocument = ((msg.documentWithCaptionMessage as { message?: { documentMessage?: EvolutionMedia } } | undefined)
    ?.message?.documentMessage);
  const documentMessage = directDocument ?? wrappedDocument;
  const audioMessage = msg.audioMessage as EvolutionMedia | undefined;
  const imageMessage = msg.imageMessage as EvolutionMedia | undefined;
  const extendedText = msg.extendedTextMessage as { text?: string } | undefined;

  const fileName = audioMessage?.fileName ?? documentMessage?.fileName ?? null;
  const mimeType = audioMessage?.mimetype
    ?? audioMessage?.mimeType
    ?? imageMessage?.mimetype
    ?? imageMessage?.mimeType
    ?? documentMessage?.mimetype
    ?? documentMessage?.mimeType
    ?? null;
  const mediaUrl = audioMessage?.url ?? imageMessage?.url ?? documentMessage?.url ?? null;
  const hasAudio = Boolean(audioMessage) || isAudioDocument(documentMessage);
  const hasImage = Boolean(imageMessage) || isImageDocument(documentMessage);

  let text = String(
    msg.conversation
      ?? extendedText?.text
      ?? imageMessage?.caption
      ?? documentMessage?.caption
      ?? "",
  ).trim();

  if (!text && hasAudio) text = fileName ? `[AUDIO] ${fileName}` : "[AUDIO]";
  if (!text && hasImage) text = fileName ? `[IMAGE] ${fileName}` : "[IMAGE]";

  if (!text) return null;

  return {
    phone,
    text,
    fromMe: Boolean(key?.fromMe),
    mediaKind: hasAudio ? "audio" : hasImage ? "image" : "text",
    mediaUrl,
    fileName,
    messageId: key?.id ?? null,
    mimeType,
  };
}

function isAudioDocument(documentMessage: EvolutionMedia | undefined) {
  if (!documentMessage) return false;
  return startsWithMime(documentMessage, "audio/") || hasExtension(documentMessage.fileName, ["mp3", "wav", "wave", "flac", "m4a", "aac", "ogg"]);
}

function isImageDocument(documentMessage: EvolutionMedia | undefined) {
  if (!documentMessage) return false;
  return startsWithMime(documentMessage, "image/") || hasExtension(documentMessage.fileName, ["jpg", "jpeg", "png", "webp"]);
}

function startsWithMime(message: EvolutionMedia, prefix: string) {
  const mime = (message.mimetype ?? message.mimeType ?? "").toLowerCase();
  return mime.startsWith(prefix);
}

function hasExtension(fileName: string | null | undefined, extensions: string[]) {
  const extension = fileName?.split(".").pop()?.toLowerCase();
  return Boolean(extension && extensions.includes(extension));
}
