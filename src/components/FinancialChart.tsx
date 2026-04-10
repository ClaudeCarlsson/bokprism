"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { formatSEK, formatPeriod } from "@/lib/format";
import type { FinancialHistory } from "@/lib/types";

interface FinancialChartProps {
  history: FinancialHistory[];
  metrics: {
    key: string;
    label: string;
    color: string;
    type: "bar" | "line";
  }[];
  title?: string;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <p className="mb-2 font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatSEK(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function FinancialChart({ history, metrics, title }: FinancialChartProps) {
  if (history.length === 0) return null;

  const data = history.map(h => {
    const point: Record<string, string | number> = { period: formatPeriod(h.period_end) };
    for (const m of metrics) {
      point[m.label] = h.metrics[m.key] ?? 0;
    }
    return point;
  });

  return (
    <div>
      {title && (
        <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      )}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-700" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 12 }}
              className="text-zinc-600 dark:text-zinc-400"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(v: number) => formatSEK(v)}
              className="text-zinc-600 dark:text-zinc-400"
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {metrics.map(m =>
              m.type === "bar" ? (
                <Bar
                  key={m.key}
                  dataKey={m.label}
                  fill={m.color}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={60}
                />
              ) : (
                <Line
                  key={m.key}
                  dataKey={m.label}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={{ r: 4, fill: m.color }}
                />
              )
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Pre-configured chart variants
export function RevenueChart({ history }: { history: FinancialHistory[] }) {
  return (
    <FinancialChart
      history={history}
      title="Omsättning & Resultat"
      metrics={[
        { key: "Nettoomsattning", label: "Omsättning", color: "#3b82f6", type: "bar" },
        { key: "AretsResultat", label: "Resultat", color: "#10b981", type: "line" },
      ]}
    />
  );
}

export function BalanceChart({ history }: { history: FinancialHistory[] }) {
  return (
    <FinancialChart
      history={history}
      title="Tillgångar & Eget kapital"
      metrics={[
        { key: "Tillgangar", label: "Tillgångar", color: "#6366f1", type: "bar" },
        { key: "EgetKapital", label: "Eget kapital", color: "#f59e0b", type: "bar" },
        { key: "KortfristigaSkulder", label: "Kortfristiga skulder", color: "#ef4444", type: "line" },
      ]}
    />
  );
}

export function ProfitabilityChart({ history }: { history: FinancialHistory[] }) {
  return (
    <FinancialChart
      history={history}
      title="Resultatutveckling"
      metrics={[
        { key: "Rorelseresultat", label: "Rörelseresultat", color: "#8b5cf6", type: "bar" },
        { key: "ResultatEfterFinansiellaPoster", label: "Res. efter fin.", color: "#06b6d4", type: "line" },
        { key: "AretsResultat", label: "Nettoresultat", color: "#10b981", type: "line" },
      ]}
    />
  );
}
