import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  href?: string;
  icon: LucideIcon;
}

export function StatCard({ label, value, subtitle, href, icon: Icon }: StatCardProps) {
  const content = (
    <Card className="hover:border-border/80 transition-colors">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-fg-muted">{label}</span>
          <Icon className="h-4 w-4 text-fg-muted" />
        </div>
        <div className="financial text-3xl font-bold">{value}</div>
        {subtitle && (
          <div className="text-xs text-fg-muted mt-1">{subtitle}</div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
