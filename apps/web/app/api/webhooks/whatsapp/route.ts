import { NextRequest, NextResponse } from "next/server";
import { StepMachine } from "@ar/wa/machine";
import { EvolutionProvider } from "@ar/wa/provider";
import type { Draft, HandlerContext, Step } from "@ar/wa/types";
import { extractIncomingEvolutionMessage } from "@/lib/wa/evolution-message";
import { isTenantSwitchCommand } from "@/lib/wa/flow-commands";
import { createHandlerDB } from "@/lib/wa/handler-db";
import { loadSession, saveSession, expireSession, expireAllSessionsForPhone } from "@/lib/wa/session-store";
import {
  resolveTenantByPhone,
  resolveTenantByCode,
  registerIdentity,
  forgetTenantByPhone,
  type TenantInfo,
} from "@/lib/wa/tenant-resolver";

type EvolutionConfig = {
  apiKey: string;
  baseUrl: string;
  instance: string;
};

function getEvolutionConfig(): EvolutionConfig | null {
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const baseUrl = process.env.EVOLUTION_BASE_URL?.trim().replace(/\/$/, "");
  const instance = process.env.EVOLUTION_INSTANCE?.trim();
  if (!apiKey || !baseUrl || !instance) return null;

  try {
    if (new URL(baseUrl).protocol !== "https:") return null;
  } catch {
    return null;
  }

  return { apiKey, baseUrl, instance };
}

function matchesSecret(provided: string | null, expected: string) {
  if (!provided) return false;
  const left = new TextEncoder().encode(provided);
  const right = new TextEncoder().encode(expected);
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left[index]! ^ right[index]!;
  }
  return mismatch === 0;
}

function getProvider(config: EvolutionConfig): EvolutionProvider {
  return new EvolutionProvider(config.baseUrl, config.apiKey, config.instance);
}

type ReplyFailureCode = "unauthorized" | "forbidden" | "not_found" | "rate_limited" | "fetch_failed" | "send_failed";

function classifyReplyError(err: unknown): ReplyFailureCode {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

  if (message.includes("401")) return "unauthorized";
  if (message.includes("403")) return "forbidden";
  if (message.includes("404")) return "not_found";
  if (message.includes("429")) return "rate_limited";
  if (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("econn") ||
    message.includes("etimedout") ||
    message.includes("timeout")
  ) {
    return "fetch_failed";
  }

  return "send_failed";
}

function firstQuestion(tenantName: string) {
  return [
    `Fala! Aqui é o *${tenantName}*.`,
    "",
    "Primeiro: esse envio é *single* ou *álbum/EP*?",
    "",
    "Se precisar corrigir em qualquer pergunta, escreva *voltar*.",
  ].join("\n");
}

async function startIntake(phone: string, tenant: TenantInfo, config: EvolutionConfig) {
  await expireAllSessionsForPhone(phone);
  await registerIdentity(phone, tenant.tenant_id);
  await saveSession(phone, tenant.tenant_id, "ask_release_format", {});

  const provider = getProvider(config);
  try {
    await provider.sendText(phone, firstQuestion(tenant.tenant_name));
    return { ok: true as const };
  } catch (err) {
    console.error("Failed to send greeting reply:", err);
    return { ok: false as const, error_code: classifyReplyError(err) };
  }
}

export async function POST(req: NextRequest) {
  const config = getEvolutionConfig();
  if (!config) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  if (!matchesSecret(req.headers.get("apikey"), config.apiKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = String(body.event ?? "").trim().toLowerCase();
  if (eventName !== "messages.upsert" && eventName !== "messages_upsert") {
    return NextResponse.json({ status: "ignored" });
  }
  if (String(body.instance ?? "").trim() !== config.instance) {
    return NextResponse.json({ status: "ignored" });
  }

  const data = body.data as Record<string, unknown> | undefined;
  if (!data) {
    return NextResponse.json({ status: "ignored" });
  }

  const incoming = extractIncomingEvolutionMessage(data);
  if (!incoming || incoming.fromMe) {
    return NextResponse.json({ status: "ignored" });
  }

  const phone = incoming.phone;
  const message = incoming.text;

  if (isTenantSwitchCommand(message)) {
    await Promise.all([
      forgetTenantByPhone(phone),
      expireAllSessionsForPhone(phone),
    ]);

    const provider = getProvider(config);
    try {
      await provider.sendText(
        phone,
        "Combinado. Apaguei o selo vinculado a este WhatsApp. Me manda o número de registro do selo (tipo *A7K9*) para eu associar de novo.",
      );
    } catch (err) {
      console.error("Failed to send tenant switch reply:", err);
    }
    return NextResponse.json({ status: "tenant_switch_requested" });
  }

  const codeMatch = message.toUpperCase().match(/^#?\s*([A-Z0-9]{3,8})$/);
  if (codeMatch) {
    const tenantByCode = await resolveTenantByCode(codeMatch[1]!);
    if (tenantByCode) {
      const reply = await startIntake(phone, tenantByCode, config);
      if (!reply.ok) {
        return NextResponse.json({ status: "reply_failed", error_code: reply.error_code }, { status: 502 });
      }
      return NextResponse.json({ status: "greeted", reply_sent: true });
    }
  }

  const tenant = await resolveTenantByPhone(phone);

  if (!tenant) {
    const provider = getProvider(config);
    try {
      await provider.sendText(
        phone,
        "Oi! Pra começar, me manda o número de registro do selo (tipo *A7K9*). Quem te chamou pra lançar consegue te passar.",
      );
    } catch (err) {
      console.error("Failed to send 'ask for code' reply:", err);
    }
    return NextResponse.json({ status: "asked_for_code" });
  }

  const session = await loadSession(phone, tenant.tenant_id);
  const currentStep = session?.step ?? "ask_release_format";
  const currentDraft: Draft = session?.draft ?? {};

  if (!session) {
    await saveSession(phone, tenant.tenant_id, "ask_release_format", currentDraft);
  }

  const db = createHandlerDB();
  const provider = getProvider(config);

  const ctx: HandlerContext = {
    tenant_id: tenant.tenant_id,
    tenant_name: tenant.tenant_name,
    phone,
    provider,
    db,
    incomingMedia: incoming.mediaKind === "text"
      ? undefined
      : {
          kind: incoming.mediaKind,
          url: incoming.mediaUrl,
          fileName: incoming.fileName,
          messageId: incoming.messageId,
          mimeType: incoming.mimeType,
        },
  };

  const machine = new StepMachine(currentStep as Step, currentDraft, ctx);

  const start = Date.now();
  let result;
  try {
    result = await machine.process(message);
  } catch (err) {
    console.error("State machine error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  const latency = Date.now() - start;

  const nextDraft = { ...currentDraft, ...result.draft };
  if (result.nextStep === "done") {
    await expireSession(phone, tenant.tenant_id);
  } else {
    await saveSession(phone, tenant.tenant_id, result.nextStep, nextDraft);
  }

  if (result.reply) {
    try {
      await provider.sendText(phone, result.reply);
    } catch (err) {
      console.error("Failed to send WhatsApp reply:", err);
    }
  }

  return NextResponse.json({
    status: "processed",
    step: result.nextStep,
    latency_ms: latency,
  });
}

export async function GET() {
  return NextResponse.json({ status: "ok", service: "aer-digital-whatsapp-webhook" });
}
