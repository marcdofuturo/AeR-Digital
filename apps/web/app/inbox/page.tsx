import { Suspense } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSubmissions } from "@/lib/data/inbox";
import { getCurrentTenantId } from "@/lib/tenant";
import { fmtDate } from "@ar/shared";
import { Inbox, Clock, CheckCircle2, ArrowRightCircle } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" }> = {
  ativa: { label: "Ativa", variant: "warning" },
  confirmada: { label: "Confirmada", variant: "success" },
  concluida: { label: "Concluída", variant: "default" },
  expirada: { label: "Expirada", variant: "secondary" },
  convertida: { label: "Convertida", variant: "success" },
};

const FILTER_TABS = [
  { label: "Todas", value: "" },
  { label: "Ativas", value: "ativa" },
  { label: "Confirmadas", value: "confirmada" },
  { label: "Convertidas", value: "convertida" },
];

interface InboxPageProps {
  searchParams: Promise<{ status?: string }>;
}

async function SubmissionsList({ status }: { status?: string }) {
  const tenantId = await getCurrentTenantId();
  const submissions = await getSubmissions(tenantId ?? undefined, { status });

  if (!submissions.length) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="flex justify-center mb-3">
            <Inbox className="h-10 w-10 text-fg-muted" />
          </div>
          <p className="text-fg-muted mb-1">Nenhuma submissão encontrada</p>
          <p className="text-sm text-fg-muted">
            As submissões enviadas pelo WhatsApp aparecerão aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {submissions.map((s: any) => {
        const sm = STATUS_MAP[s.status] ?? { label: s.status, variant: "secondary" as const };
        const draft = s.whatsapp_sessions?.draft ?? {};
        const title = draft?.title ?? "Sem título";
        const artists = draft?.artists ?? [];
        const phone = s.whatsapp_sessions?.phone ?? s.whatsapp_identities?.phone_e164;
        const stepCount = s.whatsapp_sessions?.step
          ? ["ask_title", "ask_artists", "ask_producers", "ask_producer_position", "ask_genres", "ask_date", "ask_audio", "ask_cover", "confirm"].indexOf(s.whatsapp_sessions.step) + 1
          : 0;

        return (
          <Link key={s.id} href={`/inbox/${s.id}`}>
            <Card className="hover:border-border/80 transition-colors cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-fg truncate">{title}</h3>
                      <Badge variant={sm.variant}>{sm.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-fg-muted">
                      {artists.length > 0 && (
                        <span>{artists.map((a: any) => a.stage_name ?? a.input_name).join(", ")}</span>
                      )}
                      {phone && <span>{phone}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    {stepCount > 0 && (
                      <div className="text-xs text-fg-muted text-right">
                        <div>{stepCount}/10</div>
                        <div>perguntas</div>
                      </div>
                    )}
                    <div className="text-xs text-fg-muted text-right">
                      <div>{fmtDate(s.created_at, "dd/MM")}</div>
                    </div>
                    <ArrowRightCircle className="h-4 w-4 text-fg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const { status } = await searchParams;

  return (
    <div className="p-8 max-w-[1100px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-fg">Inbox</h1>
          <p className="text-sm text-fg-muted mt-1">
            Gerencie as submissões recebidas pelo WhatsApp
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {FILTER_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value ? `/inbox?status=${tab.value}` : "/inbox"}
            className={`px-4 py-2 rounded-md text-sm border transition-colors ${
              (status ?? "") === tab.value
                ? "border-brand bg-brand/10 text-brand"
                : "border-border bg-surface text-fg-muted hover:text-fg hover:border-border/80"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Submissions list */}
      <Suspense fallback={
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
      }>
        <SubmissionsList status={status} />
      </Suspense>

      {/* Intake link */}
      <div className="mt-8 bg-gradient-to-r from-brand/10 to-purple-900/20 border border-brand/20 rounded-lg p-6">
        <h2 className="font-semibold text-fg mb-2">Link de Intake</h2>
        <p className="text-sm text-fg-muted mb-3">
          Compartilhe este link com seus artistas:
        </p>
        <code className="block bg-bg border border-border rounded-lg px-4 py-3 text-sm text-brand font-mono break-all">
          https://wa.me/5511948059297?text=%23A7K9
        </code>
      </div>
    </div>
  );
}
