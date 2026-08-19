"use client";

import { useId, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  FileAudio2,
  ImageIcon,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COVER_HEADER_BYTES,
  parseCoverMetadata,
  parseWavMetadata,
  validateCoverMetadata,
  validateWavMetadata,
  WAV_HEADER_BYTES,
} from "@/lib/media/media-contract";
import { cn } from "@/lib/utils";
import { completeWhatsappMediaUpload, createWhatsappMediaUpload } from "./actions";

type MediaKind = "audio" | "cover";
type SelectedMedia = {
  file: File;
  contentType: string;
  detail: string;
};

type ProgressState = {
  audio: number;
  cover: number;
};

const AUDIO_TYPES = ["audio/wav", "audio/x-wav", "audio/wave"];
const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function normalizedContentType(file: File, kind: MediaKind) {
  const current = file.type.trim().toLowerCase();
  const name = file.name.toLowerCase();
  if (kind === "audio") {
    if (AUDIO_TYPES.includes(current)) return current;
    return name.endsWith(".wav") ? "audio/wav" : null;
  }
  if (COVER_TYPES.includes(current)) return current;
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return null;
}

async function validateSelection(file: File, kind: MediaKind): Promise<SelectedMedia> {
  if (file.size <= 0) throw new Error("O arquivo est\u00e1 vazio.");
  const contentType = normalizedContentType(file, kind);
  if (!contentType) {
    throw new Error(kind === "audio" ? "Selecione um arquivo WAV." : "Selecione uma capa PNG, JPEG ou WebP.");
  }

  const headerLimit = kind === "audio" ? WAV_HEADER_BYTES : COVER_HEADER_BYTES;
  const bytes = new Uint8Array(await file.slice(0, headerLimit).arrayBuffer());
  if (kind === "audio") {
    const metadata = validateWavMetadata(parseWavMetadata(bytes));
    return {
      file,
      contentType,
      detail: `${metadata.channels === 2 ? "Est\u00e9reo" : `${metadata.channels} canais`} \u00b7 44,1 kHz \u00b7 16-bit`,
    };
  }

  const metadata = validateCoverMetadata(parseCoverMetadata(bytes));
  return {
    file,
    contentType,
    detail: `${metadata.width}x${metadata.height} px \u00b7 ${metadata.format.toUpperCase()}`,
  };
}

async function uploadToSignedUrl(
  selected: SelectedMedia,
  ticket: Awaited<ReturnType<typeof createWhatsappMediaUpload>>,
  onProgress: (progress: number) => void,
) {
  const publicApiKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!publicApiKey) throw new Error("Armazenamento n\u00e3o configurado.");

  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", ticket.signedUrl);
    request.setRequestHeader("apikey", publicApiKey);
    request.setRequestHeader("authorization", `Bearer ${publicApiKey}`);
    request.setRequestHeader("x-upsert", "false");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onerror = () => reject(new Error("Falha de rede durante o envio."));
    request.onabort = () => reject(new Error("Envio cancelado."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error("O armazenamento recusou o arquivo. Tente novamente."));
    };

    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", selected.file);
    request.send(body);
  });
}

export function UploadExperience({ grant }: { grant: string }) {
  const [audio, setAudio] = useState<SelectedMedia | null>(null);
  const [cover, setCover] = useState<SelectedMedia | null>(null);
  const [errors, setErrors] = useState<Partial<Record<MediaKind | "form", string>>>({});
  const [progress, setProgress] = useState<ProgressState>({ audio: 0, cover: 0 });
  const [phase, setPhase] = useState<"idle" | "uploading" | "validating" | "done">("idle");
  const [whatsappUrl, setWhatsappUrl] = useState("https://wa.me/5511948059297");
  const isBusy = phase === "uploading" || phase === "validating";

  async function selectFile(kind: MediaKind, file: File) {
    setErrors((current) => ({ ...current, [kind]: undefined, form: undefined }));
    try {
      const selected = await validateSelection(file, kind);
      if (kind === "audio") setAudio(selected);
      else setCover(selected);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Arquivo inv\u00e1lido.";
      setErrors((current) => ({ ...current, [kind]: message }));
      if (kind === "audio") setAudio(null);
      else setCover(null);
    }
  }

  async function submit() {
    if (!audio || !cover || isBusy) return;
    setErrors({});
    setProgress({ audio: 0, cover: 0 });
    setPhase("uploading");

    try {
      const [audioTicket, coverTicket] = await Promise.all([
        createWhatsappMediaUpload({
          grant,
          kind: "audio",
          fileName: audio.file.name,
          contentType: audio.contentType,
          size: audio.file.size,
        }),
        createWhatsappMediaUpload({
          grant,
          kind: "cover",
          fileName: cover.file.name,
          contentType: cover.contentType,
          size: cover.file.size,
        }),
      ]);

      await Promise.all([
        uploadToSignedUrl(audio, audioTicket, (value) => setProgress((current) => ({ ...current, audio: value }))),
        uploadToSignedUrl(cover, coverTicket, (value) => setProgress((current) => ({ ...current, cover: value }))),
      ]);

      setPhase("validating");
      const result = await completeWhatsappMediaUpload({
        grant,
        audio: { path: audioTicket.path, fileName: audio.file.name },
        cover: { path: coverTicket.path },
      });
      setWhatsappUrl(result.whatsappUrl);
      setPhase("done");

      window.setTimeout(() => {
        window.close();
        window.setTimeout(() => window.location.assign(result.whatsappUrl), 250);
      }, 900);
    } catch (error) {
      setPhase("idle");
      setErrors({
        form: error instanceof Error
          ? error.message
          : "N\u00e3o foi poss\u00edvel concluir o envio. Tente novamente.",
      });
    }
  }

  if (phase === "done") {
    return (
      <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg px-5 py-12 text-fg">
        <Backdrop />
        <section className="relative w-full max-w-lg rounded-2xl border border-success/25 bg-surface/95 p-7 text-center shadow-2xl shadow-black/40 sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-success/30 bg-success/10">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-success">Envio concluído</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Arquivos recebidos</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-fg-muted">
            O áudio e a capa foram validados. A conversa continuará no WhatsApp.
          </p>
          <Button asChild size="lg" className="mt-7 w-full">
            <a href={whatsappUrl}>
              Voltar ao WhatsApp
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-bg text-fg">
      <Backdrop />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-6 sm:px-8 sm:py-10">
        <header className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white shadow-lg shadow-brand/20">A</span>
              <span className="text-sm font-bold tracking-[0.18em]">AUDIOLINK</span>
            </div>
            <p className="mt-1 pl-10 text-[10px] font-medium uppercase tracking-[0.24em] text-fg-muted">Distribution</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-[11px] font-medium text-fg-muted backdrop-blur">
            <LockKeyhole className="h-3.5 w-3.5 text-brand-subtle" />
            Envio seguro
          </div>
        </header>

        <section className="mx-auto mt-10 w-full max-w-2xl pb-10 sm:mt-14">
          <div className="mb-8">
            <div className="mb-5 flex items-center gap-3 text-xs font-medium text-fg-muted">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">1</span>
              <span className="text-fg">Arquivos</span>
              <span className="h-px flex-1 bg-border" />
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-[11px]">2</span>
              <span>Confirmação</span>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-subtle">Material do lançamento</p>
            <h1 className="mt-3 max-w-xl text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">
              Envie a faixa e a capa em alta qualidade.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-fg-muted sm:text-base">
              Validamos os arquivos antes do envio para evitar recusas na distribuição.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <MediaDropCard
              kind="audio"
              selected={audio}
              error={errors.audio}
              progress={progress.audio}
              busy={isBusy}
              onSelect={(file) => void selectFile("audio", file)}
              onClear={() => setAudio(null)}
            />
            <MediaDropCard
              kind="cover"
              selected={cover}
              error={errors.cover}
              progress={progress.cover}
              busy={isBusy}
              onSelect={(file) => void selectFile("cover", file)}
              onClear={() => setCover(null)}
            />
          </div>

          {errors.form ? (
            <div role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-red-200">
              {errors.form}
            </div>
          ) : null}

          <Button
            type="button"
            size="lg"
            disabled={!audio || !cover || isBusy}
            aria-busy={isBusy}
            className="mt-6 h-12 w-full rounded-xl text-sm shadow-lg shadow-brand/15"
            onClick={() => void submit()}
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {phase === "uploading"
              ? "Enviando arquivos..."
              : phase === "validating"
                ? "Validando envio..."
                : "Enviar arquivos"}
          </Button>

          <div className="mt-6 flex items-start gap-3 rounded-xl border border-border/80 bg-surface/55 px-4 py-3.5 text-xs leading-5 text-fg-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-subtle" />
            <p>O link é temporário. Os arquivos seguem direto para o armazenamento seguro e não passam pelo WhatsApp.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function MediaDropCard({
  kind,
  selected,
  error,
  progress,
  busy,
  onSelect,
  onClear,
}: {
  kind: MediaKind;
  selected: SelectedMedia | null;
  error?: string;
  progress: number;
  busy: boolean;
  onSelect: (file: File) => void;
  onClear: () => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const isAudio = kind === "audio";
  const Icon = isAudio ? FileAudio2 : ImageIcon;
  const label = isAudio ? "\u00c1udio WAV" : "Capa quadrada";
  const requirement = isAudio
    ? "PCM \u00b7 est\u00e9reo \u00b7 16-bit \u00b7 44,1 kHz"
    : "1600 a 3000 px \u00b7 PNG, JPEG ou WebP";

  return (
    <div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="sr-only"
        aria-label={`Selecionar ${label}`}
        accept={isAudio ? ".wav,audio/wav,audio/x-wav,audio/wave" : ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"}
        disabled={busy}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) onSelect(file);
        }}
      />
      <div
        className={cn(
          "group relative min-h-56 overflow-hidden rounded-2xl border bg-surface/90 p-5 transition-[border-color,background-color,transform,box-shadow] duration-200",
          selected ? "border-brand/45 shadow-lg shadow-brand/5" : "border-border hover:-translate-y-0.5 hover:border-brand/40 hover:bg-surface-2/80",
          error && "border-danger/50",
        )}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!busy) {
            const file = event.dataTransfer.files?.[0];
            if (file) onSelect(file);
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-bg/80">
            <Icon className="h-5 w-5 text-brand-subtle" />
          </div>
          {selected && !busy ? (
            <button
              type="button"
              aria-label={`Remover ${label}`}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-fg-muted transition hover:bg-bg hover:text-fg active:scale-95"
              onClick={onClear}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <h2 className="mt-5 text-base font-semibold">{label}</h2>
        <p className="mt-1 text-xs leading-5 text-fg-muted">{requirement}</p>

        {selected ? (
          <div className="mt-5">
            <div className="flex items-center gap-2 text-xs font-medium text-success">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15"><Check className="h-3 w-3" /></span>
              Arquivo pronto
            </div>
            <p className="mt-2 truncate text-sm font-medium text-fg" title={selected.file.name}>{selected.file.name}</p>
            <p className="mt-1 text-xs text-fg-muted">{selected.detail} · {formatBytes(selected.file.size)}</p>
            {busy ? (
              <div className="mt-4" aria-label={`${label}: ${progress}% enviado`}>
                <div className="h-1.5 overflow-hidden rounded-full bg-bg">
                  <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-1.5 text-right font-mono text-[10px] text-fg-muted">{progress}%</p>
              </div>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            className="mt-5 inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-brand-subtle transition hover:text-fg active:scale-[0.98] disabled:cursor-not-allowed"
            onClick={() => inputRef.current?.click()}
          >
            <UploadCloud className="h-4 w-4" />
            Escolher arquivo
          </button>
        )}
      </div>
      {error ? <p role="alert" className="mt-2 px-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}

function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-brand/10 blur-[120px]" />
      <div className="absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-green-800/10 blur-[110px]" />
      <div className="absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:48px_48px]" />
    </div>
  );
}
