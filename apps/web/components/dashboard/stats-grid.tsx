import { Disc, Clock, FileCheck, ClipboardList } from "lucide-react";
import { StatCard } from "./stat-card";
import { getDashboardStats } from "@/lib/data/dashboard";

export async function StatsGrid() {
  const stats = await getDashboardStats();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Lançamentos ativos"
        value={stats?.activeReleases ?? "—"}
        href="/releases"
        icon={Disc}
      />
      <StatCard
        label="Pendentes de autorização"
        value={stats?.pendingAuth ?? "—"}
        href="/releases?stage=autorizacao_pendente"
        icon={FileCheck}
      />
      <StatCard
        label="Pendentes de registro"
        value={stats?.pendingReg ?? "—"}
        href="/releases?stage=registrar_obra"
        icon={ClipboardList}
      />
      <StatCard
        label="Total no catálogo"
        value={stats?.totalReleases ?? "—"}
        subtitle={stats ? `${stats.activeReleases} ativos` : undefined}
        href="/releases"
        icon={Clock}
      />
    </div>
  );
}
