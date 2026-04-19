"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { formatSEK, formatPeriod } from "@/lib/format";
import type { FinancialHistory } from "@/lib/types";
import { ChartTooltip, ChartLegend } from "./ChartChrome";

interface MetricDef {
  key: string;
  label: string;
  color: string;
  type: "bar" | "line" | "area";
}

interface FinancialChartProps {
  history: FinancialHistory[];
  metrics: MetricDef[];
  title?: string;
  showZeroLine?: boolean;
}

export function FinancialChart({ history, metrics, title, showZeroLine }: FinancialChartProps) {
  if (history.length === 0) return null;

  // Missing metrics stay null so Recharts draws a gap rather than a misleading
  // zero bar — K2 filings often omit subtotals we render as headline metrics.
  const data = history.map(h => {
    const point: Record<string, string | number | null> = { period: formatPeriod(h.period_end) };
    for (const m of metrics) {
      point[m.label] = h.metrics[m.key] ?? null;
    }
    return point;
  });

  const hasNegative = showZeroLine || data.some(d =>
    metrics.some(m => {
      const v = d[m.label];
      return typeof v === "number" && v < 0;
    })
  );

  return (
    <div className="rounded-xl border border-zinc-100 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
      {title && (
        <h3 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
      )}
      <div className="h-56 w-full overflow-hidden sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="currentColor"
              className="text-zinc-100 dark:text-zinc-800"
            />
            <XAxis
              dataKey="period"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-zinc-400 dark:text-zinc-500"
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "currentColor" }}
              tickFormatter={(v: number) => formatSEK(v)}
              className="text-zinc-400 dark:text-zinc-500"
              width={65}
            />
            {hasNegative && (
              <ReferenceLine y={0} stroke="currentColor" className="text-zinc-300 dark:text-zinc-600" strokeDasharray="2 2" />
            )}
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "currentColor", className: "text-zinc-50 dark:text-zinc-800/50" }}
            />
            <Legend content={<ChartLegend />} />
            {metrics.map(m => {
              if (m.type === "area") {
                return (
                  <Area
                    key={m.key}
                    dataKey={m.label}
                    stroke={m.color}
                    fill={m.color}
                    fillOpacity={0.1}
                    strokeWidth={2}
                    dot={{ r: 3, fill: m.color, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                  />
                );
              }
              if (m.type === "bar") {
                return (
                  <Bar
                    key={m.key}
                    dataKey={m.label}
                    fill={m.color}
                    fillOpacity={0.85}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                );
              }
              return (
                <Line
                  key={m.key}
                  dataKey={m.label}
                  stroke={m.color}
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: m.color, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Pre-configured chart variants ─────────────────────────────────

export function RevenueChart({ history }: { history: FinancialHistory[] }) {
  return (
    <FinancialChart
      history={history}
      title="Omsättning & Resultat"
      showZeroLine
      metrics={[
        { key: "RorelseintakterLagerforandringarMm", label: "Omsättning", color: "#3b82f6", type: "bar" },
        { key: "ResultatEfterFinansiellaPoster", label: "Resultat", color: "#10b981", type: "line" },
      ]}
    />
  );
}

export function BalanceChart({ history }: { history: FinancialHistory[] }) {
  return (
    <FinancialChart
      history={history}
      title="Balansräkning"
      metrics={[
        { key: "Tillgangar", label: "Tillgångar", color: "#6366f1", type: "bar" },
        { key: "EgetKapital", label: "Eget kapital", color: "#f59e0b", type: "area" },
        { key: "KortfristigaSkulder", label: "Kort. skulder", color: "#ef4444", type: "line" },
      ]}
    />
  );
}

export function ProfitabilityChart({ history }: { history: FinancialHistory[] }) {
  return (
    <FinancialChart
      history={history}
      title="Resultatutveckling"
      showZeroLine
      metrics={[
        { key: "Rorelseresultat", label: "Rörelseresultat", color: "#8b5cf6", type: "area" },
        { key: "ResultatEfterFinansiellaPoster", label: "Res. efter fin.", color: "#06b6d4", type: "line" },
        { key: "AretsResultat", label: "Nettoresultat", color: "#10b981", type: "line" },
      ]}
    />
  );
}
