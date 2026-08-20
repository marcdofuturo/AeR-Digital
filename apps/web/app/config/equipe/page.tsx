import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMembership } from "@/lib/auth/require-membership";
import { Users } from "lucide-react";
import { InviteMemberForm } from "./invite-member-form";
import { TeamMemberActions } from "./team-member-actions";

const ROLE_LABEL: Record<
  string,
  { label: string; variant: "default" | "secondary" | "success" | "warning" }
> = {
  owner: { label: "Owner", variant: "default" },
  ar: { label: "A&R", variant: "success" },
  financeiro: { label: "Financeiro", variant: "warning" },
  viewer: { label: "Viewer", variant: "secondary" },
};

export default async function EquipeConfigPage() {
  const membership = await requireMembership();
  const admin = createAdminClient();
  const { data: members } = await admin
    .from("memberships")
    .select("*, profiles!inner(full_name, email)")
    .eq("tenant_id", membership.tenantId);

  return (
    <div className="flex flex-col gap-6">
      {membership.role === "owner" ? <InviteMemberForm /> : null}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users aria-hidden />
            Equipe ({(members ?? []).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!members?.length ? (
            <p className="text-fg-muted py-8 text-center text-sm">Nenhum membro na equipe</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Funcao</TableHead>
                  {membership.role === "owner" ? (
                    <TableHead className="text-right">Acesso</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member: any) => {
                  const role = ROLE_LABEL[member.role] ?? {
                    label: member.role,
                    variant: "secondary" as const,
                  };
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6">
                            <AvatarFallback className="bg-surface-2 text-[10px]">
                              {(member.profiles?.full_name ?? "?").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-fg text-sm font-medium">
                            {member.profiles?.full_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-fg-muted text-sm">
                        {member.profiles?.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={role.variant}>{role.label}</Badge>
                      </TableCell>
                      {membership.role === "owner" ? (
                        <TableCell className="text-right">
                          {member.role !== "owner" && member.user_id !== membership.userId ? (
                            <TeamMemberActions
                              userId={member.user_id}
                              memberName={
                                member.profiles?.full_name ?? member.profiles?.email ?? "Membro"
                              }
                              role={member.role}
                            />
                          ) : (
                            <span className="text-fg-muted text-xs">Acesso protegido</span>
                          )}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
