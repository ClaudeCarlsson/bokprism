"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
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

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
      <p className="mb-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {label}
      </p>
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-6 text-sm">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-zinc-600 dark:text-zinc-400">{entry.name}</span>
            </span>
            <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
              {formatSEK(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomLegend({
  payload,
}: {
  payload?: Array<{ value: string; color: string }>;
}) {
  if (!payload) return null;
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1">
      {payload.map((entry, i) => (
        <span key={i} className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.value}
        </span>
      ))}
    </div>
  );
}

export function FinancialChart({ history, metrics, title, showZeroLine }: FinancialChartProps) {
  if (history.length === 0) return null;

  const data = history.map(h => {
    const point: Record<string, string | number> = { period: formatPeriod(h.period_end) };
    for (const m of metrics) {
      point[m.label] = h.metrics[m.key] ?? 0;
    }
    return point;
  });

  // Check if any values are negative (to show zero reference line)
  const hasNegative = showZeroLine || data.some(d =>
    metrics.some(m => (d[m.label] as number) < 0)
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
              content={<CustomTooltip />}
              cursor={{ fill: "currentColor", className: "text-zinc-50 dark:text-zinc-800/50" }}
            />
            <Legend content={<CustomLegend />} />
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
