"use client";

import { formatSEK, formatPercent, formatCount, formatPeriod } from "@/lib/format";
import { METRIC_TAXONOMY, type MetricMeta, type FinancialHistory } from "@/lib/types";

interface FinancialTableProps {
  history: FinancialHistory[];
  category: MetricMeta["category"] | MetricMeta["category"][];
  title: string;
}

export function FinancialTable({ history, category, title }: FinancialTableProps) {
  const categories = Array.isArray(category) ? category : [category];

  // Find all metrics used in this category across all periods
  const metricsInCategory = new Set<string>();
  for (const h of history) {
    for (const [metric] of Object.entries(h.metrics)) {
      const meta = METRIC_TAXONOMY[metric];
      if (meta && categories.includes(meta.category)) {
        metricsInCategory.add(metric);
      }
    }
  }

  // Sort metrics by their position in the taxonomy (insertion order)
  const orderedMetrics = Object.keys(METRIC_TAXONOMY).filter(m => metricsInCategory.has(m));

  if (orderedMetrics.length === 0) return null;

  // Show most recent periods first, max 5
  const periods = [...history].reverse().slice(0, 5);

  function formatValue(value: number | undefined, metric: string): string {
    if (value === undefined) return "–";
    const meta = METRIC_TAXONOMY[metric];
    if (meta?.category === "ratio") {
      return metric === "Soliditet" ? formatPercent(value) : formatCount(value);
    }
    return formatSEK(value);
  }

  return (
    <div>
      <h3 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th className="pb-2 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                Post
              </th>
              {periods.map(h => (
                <th
                  key={h.period_end}
                  className="pb-2 pl-4 text-right font-medium text-zinc-500 dark:text-zinc-400"
                >
                  {formatPeriod(h.period_end)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderedMetrics.map(metric => {
              const meta = METRIC_TAXONOMY[metric];
              return (
                <tr
                  key={metric}
                  className={`border-b border-zinc-100 dark:border-zinc-800 ${
                    meta?.isSubtotal
                      ? "font-semibold"
                      : ""
                  }`}
                >
                  <td
                    className={`py-2 pr-4 text-zinc-900 dark:text-zinc-100 ${
                      !meta?.isSubtotal ? "pl-4" : ""
                    }`}
                  >
                    {meta?.sv || metric}
                  </td>
                  {periods.map(h => {
                    const val = h.metrics[metric];
                    return (
                      <td
                        key={h.period_end}
                        className={`py-2 pl-4 text-right tabular-nums text-zinc-900 dark:text-zinc-100 ${
                          val != null && val < 0 ? "text-red-600 dark:text-red-400" : ""
                        }`}
                      >
                        {formatValue(val, metric)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function IncomeStatement({ history }: { history: FinancialHistory[] }) {
  return <FinancialTable history={history} category="income" title="Resultaträkning" />;
}

export function BalanceSheet({ history }: { history: FinancialHistory[] }) {
  return (
    <div className="space-y-8">
      <FinancialTable history={history} category="balance_asset" title="Tillgångar" />
      <FinancialTable
        history={history}
        category={["balance_equity", "balance_liability"]}
        title="Eget kapital & Skulder"
      />
    </div>
  );
}
