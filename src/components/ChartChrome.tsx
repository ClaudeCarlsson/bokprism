"use client";

import { formatSEK } from "@/lib/format";

export interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number | null; color: string }>;
  label?: string;
}

export function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
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

export interface ChartLegendProps {
  payload?: Array<{ value: string; color: string }>;
}

export function ChartLegend({ payload }: ChartLegendProps) {
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
