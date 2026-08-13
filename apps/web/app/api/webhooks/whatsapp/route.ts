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
} from "@/lib/wa/tenant-resolver";

function getProvider(): EvolutionProvider {
  const baseUrl = process.env.EVOLUTION_BASE_URL ?? "http://193.203.182.39:8080";
  const apiKey = process.env.EVOLUTION_API_KEY ?? "";
  const instance = process.env.EVOLUTION_INSTANCE ?? "atendimento";
  return new EvolutionProvider(baseUrl, apiKey, instance);
}

export async function POST(req: NextRequest) {
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

    const provider = getProvider();
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

  let tenant = await resolveTenantByPhone(phone);

  const codeMatch = message.toUpperCase().match(/^#?\s*([A-Z0-9]{3,8})$/);
  if (!tenant && codeMatch) {
    tenant = await resolveTenantByCode(codeMatch[1]!);
    if (tenant) {
      await registerIdentity(phone, tenant.tenant_id);
    }
  }

  if (!tenant) {
    const provider = getProvider();
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

  if (!session && codeMatch) {
    await saveSession(phone, tenant.tenant_id, "ask_release_format", {});
    const provider = getProvider();
    try {
      await provider.sendText(
        phone,
        `Fala! Aqui é o *${tenant.tenant_name}*.\n\nPrimeiro: esse envio é *single* ou *álbum/EP*?\n\nSe precisar corrigir em qualquer pergunta, escreva *voltar*.`,
      );
    } catch (err) {
      console.error("Failed to send greeting reply:", err);
    }
    return NextResponse.json({ status: "greeted" });
  }

  if (!session) {
    await saveSession(phone, tenant.tenant_id, "ask_release_format", currentDraft);
  }

  const db = createHandlerDB();
  const provider = getProvider();

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
