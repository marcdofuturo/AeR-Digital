"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { completeTrackAudioUpload, createTrackAudioUpload } from "@/app/releases/actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const MAX_AUDIO_UPLOAD_BYTES = 60 * 1024 * 1024;
const AUDIO_ACCEPT = "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/wave";

export function TrackAudioUploadButton({
  releaseId,
  trackId,
}: {
  releaseId: string;
  trackId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "uploading" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function uploadAudio(file: File) {
    const contentType = normalizedAudioContentType(file);
    if (!contentType) {
      setErrorMessage("Selecione um arquivo MP3 ou WAV válido.");
      return;
    }
    if (file.size <= 0 || file.size > MAX_AUDIO_UPLOAD_BYTES) {
      setErrorMessage("O áudio deve ter no máximo 60 MB.");
      return;
    }

    setStatus("uploading");
    setErrorMessage(null);
    try {
      const ticket = await createTrackAudioUpload({
        releaseId,
        trackId,
        fileName: file.name,
        contentType,
        size: file.size,
      });
      const { error } = await createClient()
        .storage
        .from(ticket.bucket)
        .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType });
      if (error) throw error;

      const publicUrl = await completeTrackAudioUpload({ releaseId, trackId, path: ticket.path });
      const audioUrlInput = inputRef.current?.form?.elements.namedItem("audio_url");
      if (audioUrlInput instanceof HTMLInputElement) audioUrlInput.value = publicUrl;
      setStatus("success");
      router.refresh();
    } catch {
      setStatus("idle");
      setErrorMessage("Não foi possível enviar o áudio. Tente novamente.");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <input
        ref={inputRef}
        type="file"
        accept={AUDIO_ACCEPT}
        className="sr-only"
        aria-label="Selecionar arquivo de áudio"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void uploadAudio(file);
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={status === "uploading"}
        aria-busy={status === "uploading"}
        onClick={() => inputRef.current?.click()}
      >
        {status === "uploading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : status === "success" ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {status === "uploading"
          ? "Enviando áudio..."
          : status === "success"
            ? "Áudio enviado"
            : "Substituir áudio"}
      </Button>
      {errorMessage ? (
        <p role="alert" className="max-w-64 text-right text-xs text-danger">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

function normalizedAudioContentType(file: File) {
  const contentType = file.type.trim().toLowerCase();
  if (AUDIO_ACCEPT.split(",").includes(contentType)) return contentType;
  const name = file.name.toLowerCase();
  if (name.endsWith(".wav")) return "audio/wav";
  if (name.endsWith(".mp3")) return "audio/mpeg";
  return null;
}
