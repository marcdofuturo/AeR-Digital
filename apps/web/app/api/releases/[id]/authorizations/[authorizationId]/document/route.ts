import { NextResponse } from "next/server";
import { getRelease } from "@/lib/data/releases";
import { getCurrentTenantId, getTenant } from "@/lib/tenant";
import {
  buildAuthorizationDocumentData,
  buildAuthorizationDocx,
  buildAuthorizationMarkdown,
} from "@/lib/docs/authorization-document";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; authorizationId: string }> },
) {
  const { id, authorizationId } = await params;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const [release, tenant] = await Promise.all([getRelease(tenantId, id), getTenant()]);
  if (!release) return NextResponse.json({ error: "Lançamento não encontrado" }, { status: 404 });

  const auth = ((release as any).authorizations ?? []).find((item: any) => item.id === authorizationId);
  if (!auth) return NextResponse.json({ error: "Autorização não encontrada" }, { status: 404 });

  const track = ((release as any).tracks ?? []).find((item: any) => item.id === auth.track_id);
  if (!track) return NextResponse.json({ error: "Faixa não encontrada" }, { status: 404 });

  const data = buildAuthorizationDocumentData({ release, track, tenant });
  const url = new URL(req.url);
  if (url.searchParams.get("format") === "md") {
    return new NextResponse(buildAuthorizationMarkdown(data), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
      },
    });
  }

  const docx = buildAuthorizationDocx(data);
  const filename = `Autorizacao_${safeFilename(data.trackTitle)}.docx`;
  const body = docx.buffer.slice(docx.byteOffset, docx.byteOffset + docx.byteLength) as ArrayBuffer;
  return new NextResponse(body, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

function safeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "faixa";
}
