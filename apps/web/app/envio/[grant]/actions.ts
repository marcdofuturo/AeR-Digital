"use server";

import { completeUploadedMedia } from "@ar/wa/handlers";
import { EvolutionProvider } from "@ar/wa/provider";
import { createHandlerDB } from "@/lib/wa/handler-db";
import {
  COVER_HEADER_BYTES,
  parseCoverMetadata,
  parseWavMetadata,
  validateCoverMetadata,
  validateWavMetadata,
  WAV_HEADER_BYTES,
} from "@/lib/media/media-contract";
import { createAdminClient } from "@/lib/supabase/admin";
import { advanceUploadSession } from "@/lib/wa/session-store";
import { requireWhatsappUploadSession } from "@/lib/wa/upload-session";

const BUCKET = "release-assets";
const WHATSAPP_INTAKE_URL = "https://wa.me/5511948059297";
const STORAGE_TIMEOUT_MS = 15_000;

type UploadKind = "audio" | "cover";

type TicketInput = {
  grant: string;
  kind: UploadKind;
  fileName: string;
  contentType: string;
  size: number;
};

type CompleteInput = {
  grant: string;
  audio: { path: string; fileName: string };
  cover: { path: string };
};

async function withTimeout<T>(promise: PromiseLike<T>, milliseconds: number, message: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function mediaExtension(kind: UploadKind, contentType: string) {
  if (kind === "audio") {
    if (!["audio/wav", "audio/x-wav", "audio/wave"].includes(contentType)) {
      throw new Error("O \u00e1udio precisa ser um arquivo WAV.");
    }
    return "wav";
  }

  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const extension = extensions[contentType];
  if (!extension) throw new Error("A capa precisa ser PNG, JPEG ou WebP.");
  return extension;
}

export async function createWhatsappMediaUpload(input: TicketInput) {
  if (!Number.isFinite(input.size) || input.size <= 0) throw new Error("Arquivo vazio ou inv\u00e1lido.");
  if (!input.fileName.trim() || input.fileName.length > 255) throw new Error("Nome de arquivo inv\u00e1lido.");

  const extension = mediaExtension(input.kind, input.contentType.toLowerCase());
  const session = await requireWhatsappUploadSession(input.grant);
  const path = `${session.tenantId}/whatsapp/${session.id}/${input.kind}-${crypto.randomUUID()}.${extension}`;
  const storage = createAdminClient().storage.from(BUCKET);
  const { data, error } = await storage.createSignedUploadUrl(path, { upsert: false });
  if (error || !data?.signedUrl) throw new Error("N\u00e3o foi poss\u00edvel preparar o envio do arquivo.");

  return {
    bucket: BUCKET,
    path,
    signedUrl: data.signedUrl,
    contentType: input.contentType.toLowerCase(),
  };
}

function assertSessionPath(path: string, prefix: string, kind: UploadKind) {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const extension = kind === "audio" ? "wav" : "(?:jpg|png|webp)";
  const pattern = new RegExp(`^${escapedPrefix}${kind}-[0-9a-f-]+\\.${extension}$`, "i");
  if (!pattern.test(path)) throw new Error("Caminho de arquivo inv\u00e1lido.");
}

async function readPrefix(url: string, limit: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STORAGE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Range: `bytes=0-${limit - 1}` },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok || !response.body) throw new Error("N\u00e3o foi poss\u00edvel validar o arquivo enviado.");

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (total < limit) {
        const { value, done } = await reader.read();
        if (done) break;
        const remaining = limit - total;
        const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
        chunks.push(chunk);
        total += chunk.byteLength;
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    clearTimeout(timeout);
  }
}

async function validateStoredObject(path: string, kind: UploadKind) {
  const storage = createAdminClient().storage.from(BUCKET);
  const { data: info, error } = await withTimeout(
    storage.info(path),
    STORAGE_TIMEOUT_MS,
    "Tempo esgotado ao consultar o arquivo enviado.",
  );
  if (error || !info || Number(info.size) <= 0) {
    throw new Error("Arquivo enviado n\u00e3o encontrado.");
  }

  const { data } = storage.getPublicUrl(path);
  try {
    const bytes = await readPrefix(
      data.publicUrl,
      kind === "audio" ? WAV_HEADER_BYTES : COVER_HEADER_BYTES,
    );
    if (kind === "audio") validateWavMetadata(parseWavMetadata(bytes));
    else validateCoverMetadata(parseCoverMetadata(bytes));
    return data.publicUrl;
  } catch (error) {
    await storage.remove([path]).catch(() => undefined);
    throw error;
  }
}

function evolutionProvider() {
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const baseUrl = process.env.EVOLUTION_BASE_URL?.trim().replace(/\/$/, "");
  const instance = process.env.EVOLUTION_INSTANCE?.trim();
  if (!apiKey || !baseUrl || !instance) throw new Error("WhatsApp n\u00e3o configurado.");

  const url = new URL(baseUrl);
  if (url.protocol !== "https:") throw new Error("WhatsApp n\u00e3o configurado.");
  return new EvolutionProvider(baseUrl, apiKey, instance);
}

export async function completeWhatsappMediaUpload(input: CompleteInput) {
  const session = await requireWhatsappUploadSession(input.grant);
  const prefix = `${session.tenantId}/whatsapp/${session.id}/`;
  assertSessionPath(input.audio.path, prefix, "audio");
  assertSessionPath(input.cover.path, prefix, "cover");

  const [audioUrl, coverUrl] = await Promise.all([
    validateStoredObject(input.audio.path, "audio"),
    validateStoredObject(input.cover.path, "cover"),
  ]);

  const result = await withTimeout(
    completeUploadedMedia(
      session.draft,
      {
        tenant_id: session.tenantId,
        db: createHandlerDB(),
      },
      { audioUrl, coverUrl, audioFilename: input.audio.fileName },
    ),
    30_000,
    "Tempo esgotado ao preparar a continua\u00e7\u00e3o do atendimento.",
  );
  const nextDraft = { ...session.draft, ...result.draft };
  await withTimeout(
    advanceUploadSession(session.id, result.nextStep, nextDraft),
    STORAGE_TIMEOUT_MS,
    "Tempo esgotado ao atualizar o atendimento.",
  );

  let replySent = true;
  try {
    await evolutionProvider().sendText(session.phone, result.reply);
  } catch (error) {
    replySent = false;
    console.error("Failed to resume WhatsApp after media upload:", error);
  }

  return {
    replySent,
    whatsappUrl: WHATSAPP_INTAKE_URL,
    nextStep: result.nextStep,
    reply: result.reply,
  };
}
