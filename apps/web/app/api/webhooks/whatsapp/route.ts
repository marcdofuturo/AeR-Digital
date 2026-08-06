// ─── WhatsApp Webhook Route ──────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { StepMachine } from "@ar/wa/machine";
import { MockProvider } from "@ar/wa/provider";
import type { HandlerDB, HandlerContext, ResolvedArtist, Draft } from "@ar/wa/types";

/** In-memory session store. Replace with DB in production. */
const sessions = new Map<string, { step: string; draft: Draft }>();

/** Resolve tenant from phone or code. Replace with DB lookup. */
async function resolveTenant(phone: string, firstMessage: string): Promise<{ tenant_id: string; tenant_name: string } | null> {
  // TODO: DB lookup — whatsapp_identities or intake_code
  // For now returns a placeholder
  return { tenant_id: "mock-tenant", tenant_name: "SuperTime Digital" };
}

/** Simple HMAC validation placeholder */
function validateWebhookSignature(req: NextRequest): boolean {
  // TODO: Implement HMAC-SHA256 validation
  return true;
}

export async function POST(req: NextRequest) {
  if (!validateWebhookSignature(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const phone = body.data?.key?.remoteJidAlt ?? body.data?.key?.remoteJid ?? body.remoteJid;
  let message = body.data?.message?.conversation ?? body.data?.message?.extendedTextMessage?.text ?? body.message?.text ?? "";
  const mediaUrl = body.data?.message?.audioMessage?.url ?? body.data?.message?.imageMessage?.url;

  if (!phone || !message) {
    return NextResponse.json({ status: "ignored" });
  }

  // Resolve tenant
  const tenant = await resolveTenant(phone, message);
  if (!tenant) {
    return NextResponse.json({ reply: "Oi! Pra começar, me manda o código do seu selo (tipo #A7K9). Quem te chamou pra lançar consegue te passar." });
  }

  // Check for intake code in first message
  const codeMatch = message.match(/^#([A-Z0-9]{3,8})$/);
  if (codeMatch) {
    message = ""; // just the code, no real message
  }

  // Load or create session
  let session = sessions.get(phone);
  if (!session) {
    session = { step: "ask_title", draft: {} };
    sessions.set(phone, session);
  }

  // Build handler context
  const db: HandlerDB = {
    async findArtist(tenantId: string, name: string): Promise<ResolvedArtist | null> {
      // TODO: query Supabase
      return null;
    },
    async createArtist(tenantId: string, stageName: string): Promise<ResolvedArtist> {
      return {
        id: crypto.randomUUID(),
        stage_name: stageName,
        input_name: stageName,
        position: 0,
        billing_role: "primary",
        is_producer: false,
        is_composer: true,
        is_performer: true,
        hidden_from_billing: false,
        match_score: 0,
        needs_review: true,
      };
    },
    async createRelease(params) {
      // TODO: insert into Supabase
      return { releaseId: crypto.randomUUID(), trackId: crypto.randomUUID() };
    },
  };

  const ctx: HandlerContext = {
    tenant_id: tenant.tenant_id,
    tenant_name: tenant.tenant_name,
    phone,
    provider: new MockProvider(),
    db,
  };

  // Open with greeting if first message is a code
  if (session.step === "ask_title" && !message && codeMatch) {
    sessions.set(phone, {
      step: "ask_title",
      draft: {},
    });

    await ctx.provider.sendText(phone, `Fala! 👋 Aqui é o ${ctx.tenant_name}.\n\nVou te fazer 5 perguntas rapidinhas e no fim você me manda a música e a capa. Leva 1 minuto.\n\n*1. Qual o nome da música?*`);
    return NextResponse.json({ status: "greeted" });
  }

  // Process message
  const machine = new StepMachine(
    session.step as any,
    session.draft as Draft,
    ctx,
  );

  const start = Date.now();
  const result = await machine.process(message);
  const latency = Date.now() - start;

  // Update session
  session.step = result.nextStep;
  session.draft = { ...session.draft, ...result.draft };
  sessions.set(phone, session);

  // Send reply
  if (result.reply) {
    await ctx.provider.sendText(phone, result.reply);
  }

  return NextResponse.json({
    status: "processed",
    step: result.nextStep,
    latency_ms: latency,
  });
}
