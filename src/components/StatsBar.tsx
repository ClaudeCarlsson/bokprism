import type { SiteStats } from "@/lib/types";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export function StatsBar({ stats }: { stats: SiteStats }) {
  const items = [
    { label: "Företag", value: formatNumber(stats.total_companies) },
    { label: "Bokslut", value: formatNumber(stats.total_filings) },
    { label: "Datapunkter", value: formatNumber(stats.total_data_points) },
    { label: "Personer", value: formatNumber(stats.total_people) },
    { label: "År", value: stats.years_covered },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-6 text-center text-sm sm:gap-10">
      {items.map(item => (
        <div key={item.label}>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {item.value}
          </div>
          <div className="text-zinc-500 dark:text-zinc-400">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
