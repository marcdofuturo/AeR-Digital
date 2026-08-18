import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { classifyResponse } from "@ar/docs-gen/classifier";
import { createAdminClient } from "@/lib/supabase/admin";

type ResendEvent = {
  type?: string;
  data?: { email_id?: string };
};

type ReceivedEmail = {
  to?: string[];
  text?: string | null;
  html?: string | null;
};

type AppliedReply = {
  matched: boolean;
  recipient_status: string | null;
  authorization_status: string | null;
};

export async function POST(req: NextRequest) {
  const signingSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!signingSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signature = req.headers.get("svix-signature");
  if (!id || !timestamp || !signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const rawPayload = await req.text();
  let event: ResendEvent;
  try {
    event = new Webhook(signingSecret).verify(rawPayload, {
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    }) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ status: "ignored" });
  }

  const emailId = event.data?.email_id;
  const apiKey = process.env.RESEND_API_KEY;
  if (!emailId || !apiKey) {
    return NextResponse.json({ error: "Inbound email not configured" }, { status: 503 });
  }

  const emailResponse = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
    headers: { authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!emailResponse.ok) {
    return NextResponse.json({ error: "Email content unavailable" }, { status: 502 });
  }

  const email = await emailResponse.json() as ReceivedEmail;
  const toAddress = email.to?.find((address) => /^auth\+[^@]+@/i.test(address)) ?? "";
  const replyToken = toAddress.match(/^auth\+([^@]+)@/i)?.[1] ?? null;
  if (!replyToken) return NextResponse.json({ status: "unmatched" });

  const textBody = email.text?.trim() || stripHtml(email.html ?? "");
  const cleaned = cleanQuotedReply(textBody);
  const classification = await classifyResponse(cleaned);
  const highConfidence = classification.confianca >= 0.8;
  const autoApprove = classification.decisao === "aprovado" && highConfidence;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("apply_authorization_reply", {
    p_reply_token: replyToken,
    p_response_raw: cleaned.slice(0, 20_000),
    p_response_class: classification,
    p_decision: classification.decisao,
    p_high_confidence: highConfidence,
  });
  if (error) {
    return NextResponse.json({ error: "Reply persistence failed" }, { status: 500 });
  }

  const applied = (Array.isArray(data) ? data[0] : data) as AppliedReply | null;
  if (!applied?.matched) return NextResponse.json({ status: "unmatched" });

  return NextResponse.json({
    auto_approve: autoApprove,
    classification,
    status: applied.recipient_status === "aprovado"
      ? "approved"
      : applied.recipient_status === "recusado"
        ? "refused"
        : "requires_review",
  });
}

function cleanQuotedReply(body: string): string {
  return body
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n")
    .replace(/On .+ wrote:/gi, "")
    .trim();
}

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}
