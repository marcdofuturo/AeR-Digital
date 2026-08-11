import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantId } from "@/lib/tenant";
import { Users } from "lucide-react";

const ROLE_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" }> = {
  owner: { label: "Owner", variant: "default" },
  ar: { label: "A&R", variant: "success" },
  financeiro: { label: "Financeiro", variant: "warning" },
  viewer: { label: "Viewer", variant: "secondary" },
};

export default async function EquipeConfigPage() {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("memberships")
    .select("*, profiles!inner(full_name, email)")
    .eq("tenant_id", tenantId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Equipe ({(members ?? []).length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!members?.length ? (
          <p className="text-sm text-fg-muted text-center py-8">Nenhum membro na equipe</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Função</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m: any) => {
                const role = ROLE_LABEL[m.role] ?? { label: m.role, variant: "secondary" as const };
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px] bg-surface-2">
                            {(m.profiles?.full_name ?? "?").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-fg">{m.profiles?.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-fg-muted">{m.profiles?.email}</TableCell>
                    <TableCell>
                      <Badge variant={role.variant} className="text-xs">{role.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
