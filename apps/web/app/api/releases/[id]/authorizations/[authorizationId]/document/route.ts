import { NextResponse } from "next/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { getAuthorizationDocumentSource } from "@/lib/docs/authorization-document-source";
import {
  buildAuthorizationDocumentData,
  buildAuthorizationDocx,
  buildAuthorizationMarkdown,
  buildAuthorizationPdf,
} from "@/lib/docs/authorization-document";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; authorizationId: string }> },
) {
  const { id, authorizationId } = await params;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const source = await getAuthorizationDocumentSource({ tenantId, releaseId: id, authorizationId });
  if (source.status === "authorization-not-found") {
    return NextResponse.json({ error: "Autorização não encontrada" }, { status: 404 });
  }
  if (source.status === "release-not-found") {
    return NextResponse.json({ error: "Lançamento não encontrado" }, { status: 404 });
  }
  if (source.status === "track-not-found") {
    return NextResponse.json({ error: "Faixa não encontrada" }, { status: 404 });
  }

  const data = buildAuthorizationDocumentData(source);
  const url = new URL(req.url);
  if (url.searchParams.get("format") === "md") {
    return new NextResponse(buildAuthorizationMarkdown(data), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
      },
    });
  }

  if (url.searchParams.get("format") === "pdf") {
    const pdf = buildAuthorizationPdf(data);
    const filename = `Autorizacao_${safeFilename(data.trackTitle)}.pdf`;
    const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    return new NextResponse(body, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
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
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "faixa"
  );
}
