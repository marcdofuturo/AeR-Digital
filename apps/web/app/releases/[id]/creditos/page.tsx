import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRelease } from "@/lib/data/releases";
import { getCurrentTenantId } from "@/lib/tenant";
import { Users } from "lucide-react";

export default async function CreditosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  const release = await getRelease(tenantId, id);
  if (!release) return null;

  const r = release as any;
  const tracks = r.tracks ?? [];

  return (
    <div className="space-y-6">
      {tracks.map((track: any) => (
        <Card key={track.id}>
          <CardHeader>
            <CardTitle className="text-base">{track.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {!track.track_participants?.length ? (
              <p className="text-sm text-fg-muted py-4">Nenhum participante cadastrado</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead className="text-center">Compositor</TableHead>
                    <TableHead className="text-center">Intérprete</TableHead>
                    <TableHead className="text-center">Produtor</TableHead>
                    <TableHead className="text-center">Oculto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {track.track_participants.map((tp: any) => (
                    <TableRow key={tp.id}>
                      <TableCell className="text-fg-muted tabular-nums">{tp.position}</TableCell>
                      <TableCell className="font-medium text-fg">{tp.artists?.stage_name}</TableCell>
                      <TableCell>
                        <Badge variant={tp.billing_role === "primary" ? "default" : "secondary"} className="text-xs">
                          {tp.billing_role === "primary" ? "Principal" : "Feat."}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{tp.is_composer ? "✓" : "—"}</TableCell>
                      <TableCell className="text-center">{tp.is_performer ? "✓" : "—"}</TableCell>
                      <TableCell className="text-center">{tp.is_producer ? "✓" : "—"}</TableCell>
                      <TableCell className="text-center">{tp.hidden_from_billing ? "✓" : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
