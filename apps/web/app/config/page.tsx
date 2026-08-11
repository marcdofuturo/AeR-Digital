import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Settings, PieChart, Users, Building2, Bell } from "lucide-react";

const SECTIONS = [
  { icon: Building2, title: "Dados do Selo", description: "Nome, CNPJ, logo e informações de contato", href: "/config/selo" },
  { icon: PieChart, title: "Rateio Digital", description: "Configure como o selo participa do rateio de streams", href: "/config/splits" },
  { icon: Users, title: "Equipe", description: "Gerencie membros do selo e permissões", href: "/config/equipe" },
  { icon: Bell, title: "Notificações", description: "Lembretes de autorização e prazos", href: "/config/notificacoes" },
];

export default function ConfigPage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {SECTIONS.map((s) => (
        <Link key={s.href} href={s.href}>
          <Card className="hover:border-border/80 transition-colors h-full">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <s.icon className="h-8 w-8 text-brand shrink-0" />
                <div>
                  <h3 className="font-semibold text-fg mb-1">{s.title}</h3>
                  <p className="text-sm text-fg-muted">{s.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
