import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getRelease } from "@/lib/data/releases";
import { getCurrentTenantId, getTenant } from "@/lib/tenant";
import { buildAuthorizationDocumentData } from "@/lib/docs/authorization-document";
import { AuthorizationDocumentPreview } from "@/components/docs/authorization-document-preview";
import { Download, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AuthorizationDocumentPage({
  params,
}: {
  params: Promise<{ id: string; authorizationId: string }>;
}) {
  const { id, authorizationId } = await params;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  const [release, tenant] = await Promise.all([getRelease(tenantId, id), getTenant()]);
  if (!release) return null;

  const auth = ((release as any).authorizations ?? []).find((item: any) => item.id === authorizationId);
  const track = auth ? ((release as any).tracks ?? []).find((item: any) => item.id === auth.track_id) : null;
  if (!auth || !track) return null;

  const documentData = buildAuthorizationDocumentData({ release, track, tenant });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/releases/${id}/autorizacao`}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <a href={`/api/releases/${id}/authorizations/${authorizationId}/document`}>
              <Download className="h-4 w-4" />
              Baixar DOCX
            </a>
          </Button>
          <Button asChild size="sm" variant="outline">
            <a href={`/api/releases/${id}/authorizations/${authorizationId}/document?format=pdf`}>
              <Download className="h-4 w-4" />
              Baixar PDF
            </a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documento de autorização</CardTitle>
          <CardDescription>
            Visualização preenchida automaticamente para {documentData.trackTitle}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthorizationDocumentPreview data={documentData} />
        </CardContent>
      </Card>
    </div>
  );
}
