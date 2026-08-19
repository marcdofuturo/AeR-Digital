import { loadSessionById } from "@/lib/wa/session-store";
import { verifyUploadGrant } from "@/lib/wa/upload-grant";

export async function requireWhatsappUploadSession(grant: string) {
  const { sessionId } = await verifyUploadGrant(grant);
  const session = await loadSessionById(sessionId);
  if (!session) {
    throw new Error("Sess\u00e3o de envio expirada. Volte ao WhatsApp para gerar outro link.");
  }
  if (session.step !== "ask_audio" && session.step !== "ask_cover") {
    throw new Error("Arquivos j\u00e1 recebidos. Continue o atendimento no WhatsApp.");
  }
  return session;
}
