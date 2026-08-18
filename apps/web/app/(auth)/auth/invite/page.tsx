import { Suspense } from "react";
import { InviteAcceptanceForm } from "./invite-acceptance-form";

export default function InvitePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="mx-auto w-full max-w-sm px-6">
        <div className="rounded-lg border border-border bg-surface p-6">
          <Suspense fallback={<p className="text-sm text-fg-muted">Carregando convite...</p>}>
            <InviteAcceptanceForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
