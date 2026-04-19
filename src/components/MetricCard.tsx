"use client";

import { formatMetricValue, trendDirection, trendPercent } from "@/lib/format";
import { METRIC_TAXONOMY } from "@/lib/types";

interface MetricCardProps {
  metric: string;
  value: number | null;
  previousValue?: number | null;
  compact?: boolean;
}

const TREND_LABELS: Record<"up" | "down" | "flat", string> = {
  up: "ökning",
  down: "minskning",
  flat: "oförändrad",
};

export function MetricCard({ metric, value, previousValue, compact = false }: MetricCardProps) {
  const label = METRIC_TAXONOMY[metric]?.sv || metric;
  const formatted = formatMetricValue(value, metric);
  const trend = trendDirection(value, previousValue ?? null);
  const change = trendPercent(value, previousValue ?? null);

  return (
    <div className={`rounded-lg border border-zinc-200 bg-white sm:rounded-xl dark:border-zinc-700 dark:bg-zinc-900 ${compact ? "p-2 sm:p-3" : "p-3 sm:p-4"}`}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 sm:text-xs dark:text-zinc-400">
        {label}
      </div>
      <div className={`${compact ? "mt-0.5 text-base sm:mt-1 sm:text-lg" : "mt-1 text-xl sm:mt-2 sm:text-2xl"} font-semibold text-zinc-900 dark:text-zinc-100`}>
        {formatted}
      </div>
      {trend && change != null && (
        <div
          className={`mt-0.5 flex items-center gap-1 text-xs sm:mt-1 sm:text-sm ${
            trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-zinc-400"
          }`}
        >
          <span aria-label={TREND_LABELS[trend]} role="img">
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
          </span>
          <span>{(Math.abs(change) * 100).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}
