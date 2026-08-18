"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { parseInviteSession, safeInviteDestination } from "@/lib/auth/invite-session";

type InviteState = "loading" | "ready" | "submitting" | "error";

export function InviteAcceptanceForm() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [state, setState] = useState<InviteState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    let active = true;

    async function establishSession() {
      const inviteSession = parseInviteSession(window.location.hash);
      if (inviteSession) {
        const { error } = await supabase.auth.setSession({
          access_token: inviteSession.accessToken,
          refresh_token: inviteSession.refreshToken,
        });
        if (error) {
          if (active) {
            setErrorMessage("O convite expirou ou ja foi utilizado. Solicite um novo convite.");
            setState("error");
          }
          return;
        }

        window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
      } else {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          if (active) {
            setErrorMessage("Convite invalido. Abra novamente o link recebido por email.");
            setState("error");
          }
          return;
        }
      }

      if (active) setState("ready");
    }

    void establishSession();
    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (password.length < 8) {
      setErrorMessage("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setErrorMessage("As senhas informadas nao coincidem.");
      return;
    }

    setState("submitting");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErrorMessage("Nao foi possivel definir a senha. Solicite um novo convite.");
      setState("ready");
      return;
    }

    const destination = new URLSearchParams(window.location.search).get("next");
    router.replace(safeInviteDestination(destination));
    router.refresh();
  }

  if (state === "loading") {
    return <p className="text-sm text-fg-muted" aria-live="polite">Validando convite...</p>;
  }

  if (state === "error") {
    return <p role="alert" className="text-sm text-danger">{errorMessage}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h1 className="text-2xl font-bold text-fg">Concluir convite</h1>
      <p className="text-sm text-fg-muted">Defina uma senha para ativar seu acesso ao painel.</p>

      <div>
        <label htmlFor="invite-password" className="mb-1 block text-sm font-medium text-fg">
          Nova senha
        </label>
        <input
          id="invite-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/50"
        />
      </div>

      <div>
        <label htmlFor="invite-confirmation" className="mb-1 block text-sm font-medium text-fg">
          Confirmar senha
        </label>
        <input
          id="invite-confirmation"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/50"
        />
      </div>

      <Button type="submit" className="w-full" disabled={state === "submitting"}>
        {state === "submitting" ? "Ativando acesso..." : "Ativar acesso"}
      </Button>

      {errorMessage ? <p role="alert" className="text-sm text-danger">{errorMessage}</p> : null}
    </form>
  );
}
