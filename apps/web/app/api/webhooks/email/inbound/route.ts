// ─── Email Inbound Webhook (Resend) ─────────────────────────
// POST /api/webhooks/email/inbound
import { NextRequest, NextResponse } from "next/server";
import { classifyResponse } from "@ar/docs-gen";

// Resend webhook signing secret
const RESEND_SIGNING_SECRET = process.env.RESEND_WEBHOOK_SECRET ?? "";

/** Validate Resend webhook signature */
async function validateSignature(req: NextRequest): Promise<boolean> {
  try {
    const body = await req.clone().text();
    const signature = req.headers.get("resend-signature") ?? "";
    // Resend sends svix-id, svix-timestamp, svix-signature headers
    const svixId = req.headers.get("svix-id") ?? "";
    const svixTimestamp = req.headers.get("svix-timestamp") ?? "";

    // TODO: Implement proper Svix signature validation with crypto
    // For now, validate that headers exist
    return !!(signature && svixId && svixTimestamp);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // Validate signature — REQUIRED for security (R10/security concern)
  if (!validateSignature(req)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = await req.json();

  // Extract VERP token from the "to" field
  const toAddress = body.data?.to ?? body.to ?? "";
  const verpMatch = toAddress.match(/^auth\+([^@]+)@/);
  const replyToken = verpMatch?.[1] ?? null;

  // Extract reply body (strip quoted reply)
  const textBody = body.data?.text ?? body.text ?? "";
  const htmlBody = body.data?.html ?? body.html ?? "";

  // Clean: remove quoted reply and signature
  const cleaned = cleanQuotedReply(textBody);

  // Classify using Haiku (with heuristic fallback)
  const classification = await classifyResponse(cleaned);

  // Security rule: confianca < 0.8 or não "aprovado" → never auto-approve
  const autoApprove = classification.decisao === "aprovado" && classification.confianca >= 0.8;

  return NextResponse.json({
    reply_token: replyToken,
    auto_approve: autoApprove,
    classification,
    status: autoApprove ? "approved" : "requires_review",
  });
}

/** Strip quoted reply lines (Gmail-style "> ..." blocks) */
function cleanQuotedReply(body: string): string {
  return body
    .split("\n")
    .filter(line => !line.startsWith(">"))
    .join("\n")
    .replace(/On .+ wrote:/gi, "")
    .trim();
}
