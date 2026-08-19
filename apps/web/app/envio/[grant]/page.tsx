import type { Metadata } from "next";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireWhatsappUploadSession } from "@/lib/wa/upload-session";
import { UploadExperience } from "./upload-experience";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Envio seguro | Audiolink",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function WhatsappMediaUploadPage({
  params,
}: {
  params: Promise<{ grant: string }>;
}) {
  const { grant } = await params;
  try {
    await requireWhatsappUploadSession(grant);
    return <UploadExperience grant={grant} />;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Este link n\u00e3o est\u00e1 mais dispon\u00edvel.";
    return <UnavailableUpload message={message} />;
  }
}

function UnavailableUpload({ message }: { message: string }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg px-5 py-12 text-fg">
      <div aria-hidden="true" className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-brand/10 blur-[120px]" />
      <section className="relative w-full max-w-lg rounded-2xl border border-warning/25 bg-surface/95 p-7 text-center shadow-2xl shadow-black/40 sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-warning/30 bg-warning/10">
          <AlertTriangle className="h-7 w-7 text-warning" />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-warning">Link indisponível</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Volte ao WhatsApp</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-fg-muted">{message}</p>
        <Button asChild size="lg" className="mt-7 w-full">
          <a href="https://wa.me/5511948059297">
            Abrir WhatsApp
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </Button>
      </section>
    </main>
  );
}
