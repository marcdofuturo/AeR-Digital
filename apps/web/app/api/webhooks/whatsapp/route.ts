// ─── WhatsApp Webhook Route (Evolution API) ──────────────────
// Public endpoint. Receives messages.upsert events from Evolution API,
// resolves tenant, runs the WhatsApp state machine, and persists
// sessions/releases/artists to Supabase via service_role.
//
// No auth required — this is a webhook receiver. The middleware
// exempts /api/webhooks/whatsapp from Supabase auth.
//
// Security: Evolution API calls from a known internal IP.
// Future: add HMAC or shared secret validation.

import { NextRequest, NextResponse } from "next/server";
import { StepMachine } from "@ar/wa/machine";
import { EvolutionProvider } from "@ar/wa/provider";
import type { Draft, HandlerContext } from "@ar/wa/types";
import { createHandlerDB } from "@/lib/wa/handler-db";
import { loadSession, saveSession, expireSession } from "@/lib/wa/session-store";
import {
  resolveTenantByPhone,
  resolveTenantByCode,
  registerIdentity,
} from "@/lib/wa/tenant-resolver";

// ─── Provider singleton (cold‑start friendly) ─────────────────

function getProvider(): EvolutionProvider {
  const baseUrl = process.env.EVOLUTION_BASE_URL ?? "http://46.225.220.227:8080";
  const apiKey = process.env.EVOLUTION_API_KEY ?? "";
  const instance = process.env.EVOLUTION_INSTANCE ?? "atendimento";
  return new EvolutionProvider(baseUrl, apiKey, instance);
}

// ─── POST handler ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only process messages.upsert events. Evolution deployments may send
  // either the canonical lowercase event or the configured uppercase enum.
  const eventName = String(body.event ?? "").trim().toLowerCase();
  if (eventName !== "messages.upsert" && eventName !== "messages_upsert") {
    return NextResponse.json({ status: "ignored" });
  }

  const data = body.data as Record<string, unknown> | undefined;
  if (!data) {
    return NextResponse.json({ status: "ignored" });
  }

  // Ignore outgoing messages (prevent echo loop)
  const fromMe = (data.key as Record<string, unknown>)?.fromMe as boolean | undefined;
  if (fromMe) {
    return NextResponse.json({ status: "ignored" });
  }

  // ── Extract phone ──────────────────────────────────────────
  // Evolution v2: LID addressing — prefer remoteJidAlt, fall back to remoteJid
  const key = data.key as Record<string, unknown> | undefined;
  const rawJid = (key?.remoteJidAlt as string) ?? (key?.remoteJid as string) ?? "";
  const phone = rawJid.split("@")[0] ?? rawJid;

  if (!phone) {
    return NextResponse.json({ status: "ignored" });
  }

  // ── Extract message text ────────────────────────────────────
  const msg = data.message as Record<string, unknown> | undefined;
  let message = (msg?.conversation as string) ?? (msg?.extendedTextMessage as { text?: string })?.text ?? "";
  message = message.trim();

  // Detect media (audio / image) — used by ask_audio / ask_cover
  const hasAudio = !!msg?.audioMessage;
  const hasImage = !!msg?.imageMessage;

  const audioFileName = (msg?.audioMessage as { fileName?: string })?.fileName
    ?? (msg?.documentMessage as { fileName?: string; mimetype?: string })?.fileName
    ?? "";

  if (!message && hasAudio) message = audioFileName ? `[AUDIO] ${audioFileName}` : "[AUDIO]";
  if (!message && hasImage) message = "[IMAGE]";

  if (!message) {
    return NextResponse.json({ status: "ignored" });
  }

  // ── Tenant resolution ───────────────────────────────────────
  // R6: known phone → whatsapp_identities; else intake code in message
  let tenant = await resolveTenantByPhone(phone);

  const codeMatch = message.toUpperCase().match(/^#?\s*([A-Z0-9]{3,8})$/);
  if (!tenant && codeMatch) {
    tenant = await resolveTenantByCode(codeMatch[1]!);
    if (tenant) {
      // Remember this phone for next time
      await registerIdentity(phone, tenant.tenant_id);
    }
  }

  // No tenant → ask for code
  if (!tenant) {
    const provider = getProvider();
    try {
      await provider.sendText(
        phone,
        "Oi! Pra começar, me manda o código do seu selo (tipo *A7K9*). Quem te chamou pra lançar consegue te passar.",
      );
    } catch (err) {
      console.error("Failed to send 'ask for code' reply:", err);
    }
    return NextResponse.json({ status: "asked_for_code" });
  }

  // ── Session management ──────────────────────────────────────
  const session = await loadSession(phone, tenant.tenant_id);
  const currentStep = session?.step ?? "ask_release_format";
  const currentDraft: Draft = session?.draft ?? {};

  // First message is just the intake code → greet without processing
  if (!session && codeMatch) {
    await saveSession(phone, tenant.tenant_id, "ask_release_format", {});
    const provider = getProvider();
    try {
      await provider.sendText(
        phone,
        `Fala! 👋 Aqui é o *${tenant.tenant_name}*.\n\nPrimeiro: esse envio é *single* ou *álbum/EP*?\n\nSe precisar corrigir em qualquer pergunta, escreva *voltar*.`,
      );
    } catch (err) {
      console.error("Failed to send greeting reply:", err);
    }
    return NextResponse.json({ status: "greeted" });
  }

  // No session yet → create one
  if (!session) {
    await saveSession(phone, tenant.tenant_id, "ask_release_format", currentDraft);
  }

  // ── State machine ───────────────────────────────────────────
  const db = createHandlerDB();
  const provider = getProvider();

  const ctx: HandlerContext = {
    tenant_id: tenant.tenant_id,
    tenant_name: tenant.tenant_name,
    phone,
    provider,
    db,
  };

  const machine = new StepMachine(
    currentStep as "ask_release_format",
    currentDraft,
    ctx,
  );

  const start = Date.now();
  let result;
  try {
    result = await machine.process(message);
  } catch (err) {
    console.error("State machine error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  const latency = Date.now() - start;

  // ── Persist session ─────────────────────────────────────────
  const nextDraft = { ...currentDraft, ...result.draft };
  if (result.nextStep === "done") {
    await expireSession(phone, tenant.tenant_id);
  } else {
    await saveSession(phone, tenant.tenant_id, result.nextStep, nextDraft);
  }

  // ── Send reply ──────────────────────────────────────────────
  // All replies are pre-written templates (R9 — LLM never generates
  // the message text sent to the artist).
  if (result.reply) {
    try {
      await provider.sendText(phone, result.reply);
    } catch (err) {
      console.error("Failed to send WhatsApp reply:", err);
      // Don't fail the webhook — Evolution will retry
    }
  }

  return NextResponse.json({
    status: "processed",
    step: result.nextStep,
    latency_ms: latency,
  });
}

// ─── GET handler (health check / webhook verification) ─────────

export async function GET() {
  return NextResponse.json({ status: "ok", service: "aer-digital-whatsapp-webhook" });
}
