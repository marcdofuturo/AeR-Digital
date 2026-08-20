"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CatalogGrowthChartProps {
  data: Array<{ month: string; total: number; ativos: number }>;
}

export function CatalogGrowthChart({ data }: CatalogGrowthChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catálogo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-fg-muted py-12 text-center text-sm">Nenhum lançamento ainda</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: formatMonth(d.month),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Catálogo</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#26262C" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "#A1A1AA" }}
              axisLine={{ stroke: "#26262C" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#A1A1AA" }}
              axisLine={{ stroke: "#26262C" }}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={false}
              contentStyle={{
                backgroundColor: "#131316",
                border: "1px solid #26262C",
                borderRadius: "8px",
                fontSize: "13px",
                color: "#FAFAFA",
              }}
            />
            <Bar dataKey="total" fill="#1B6B06" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function formatMonth(ym: string): string {
  const [year, month] = ym.split("-");
  if (!year || !month) return ym;
  const months = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  return `${months[parseInt(month, 10) - 1]}/${year.slice(2)}`;
}
