import { getRankings } from "@/lib/queries";
import { RANKABLE_METRICS, METRIC_TAXONOMY } from "@/lib/types";
import { formatSEK, formatOrgNumber, formatPercent, formatCount } from "@/lib/format";
import Link from "next/link";
import { RankingSelector } from "./RankingSelector";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Topplistor - BokPrism",
  description: "Se Sveriges storsta, mest lonsamma och mest vaxande foretag.",
};

interface Props {
  searchParams: Promise<{ metric?: string; order?: string }>;
}

export default async function RankingsPage({ searchParams }: Props) {
  const { metric: rawMetric, order: rawOrder } = await searchParams;
  const validMetrics = new Set<string>(RANKABLE_METRICS.map(m => m.key));
  const metric = rawMetric && validMetrics.has(rawMetric) ? rawMetric : "Nettoomsattning";
  const order = rawOrder === "asc" ? "asc" : "desc";

  const results = getRankings(metric, order as "asc" | "desc", 100);
  const meta = METRIC_TAXONOMY[metric];

  function formatValue(value: number): string {
    if (meta?.category === "ratio") {
      return metric === "Soliditet" ? formatPercent(value) : formatCount(value);
    }
    return formatSEK(value);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-100">
        Topplistor
      </h1>
      <p className="mt-2 text-sm text-zinc-500 sm:text-base">
        Rangordnade efter senaste bokslut. Data fr&aring;n Bolagsverket.
      </p>

      <div className="mt-6">
        <RankingSelector
          metrics={RANKABLE_METRICS.map(m => ({ key: m.key, label: m.label }))}
          currentMetric={metric}
          currentOrder={order}
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
              <th className="px-2 py-3 text-left font-medium text-zinc-500 sm:px-4">#</th>
              <th className="px-2 py-3 text-left font-medium text-zinc-500 sm:px-4">F&ouml;retag</th>
              <th className="px-2 py-3 text-right font-medium text-zinc-500 sm:px-4">
                {meta?.sv || metric}
              </th>
              <th className="hidden px-4 py-3 text-right font-medium text-zinc-500 sm:table-cell">
                Period
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((entry, i) => (
              <tr
                key={entry.org_number}
                className="border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
              >
                <td className="px-2 py-3 text-zinc-400 sm:px-4">{i + 1}</td>
                <td className="min-w-0 max-w-0 px-2 py-3 sm:px-4">
                  <Link
                    href={`/company/${entry.org_number}`}
                    className="line-clamp-2 break-words text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    {entry.name}
                  </Link>
                  <div className="text-xs text-zinc-500">
                    {formatOrgNumber(entry.org_number)}
                  </div>
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums font-medium text-zinc-900 sm:px-4 dark:text-zinc-100">
                  {formatValue(entry.value)}
                </td>
                <td className="hidden px-4 py-3 text-right text-zinc-500 sm:table-cell">
                  {entry.period_end}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
