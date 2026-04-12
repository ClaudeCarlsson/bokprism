import { SearchBar } from "@/components/SearchBar";
import { StatsBar } from "@/components/StatsBar";
import { getSiteStats, getRankings } from "@/lib/queries";
import Link from "next/link";
import { formatSEK, formatOrgNumber } from "@/lib/format";

// Force dynamic rendering — otherwise the page is statically prerendered at
// build time using the stub database baked into the Docker image.
export const dynamic = "force-dynamic";

export default function HomePage() {
  const stats = getSiteStats();
  const topRevenue = getRankings("RorelseintakterLagerforandringarMm", "desc", 10, "2024-01-01");
  const topProfit = getRankings("ResultatEfterFinansiellaPoster", "desc", 10, "2024-01-01");
  const topEmployees = getRankings("MedelantaletAnstallda", "desc", 10, "2024-01-01");

  return (
    <div className="mx-auto max-w-7xl px-4">
      {/* Hero Section */}
      <section className="flex flex-col items-center py-10 text-center sm:py-24">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-5xl">
          Svensk Finansdata
        </h1>
        <p className="mt-4 max-w-xl text-base text-zinc-600 sm:text-lg dark:text-zinc-400">
          {`Utforska bokslut, styrelser och kopplingar för ${stats.total_companies.toLocaleString("sv-SE")} svenska företag. Gratis, snabbt och utan reklam.`}
        </p>
        <div className="mt-6 w-full max-w-2xl sm:mt-8">
          <SearchBar />
        </div>
        <div className="mt-8 w-full sm:mt-12">
          <StatsBar stats={stats} />
        </div>
      </section>

      {/* Rankings Preview */}
      <section className="grid gap-4 pb-10 sm:gap-8 sm:pb-16 md:grid-cols-3">
        <RankingPreview title="St&ouml;rst oms&auml;ttning" metric="Omsattning" entries={topRevenue} />
        <RankingPreview title="H&ouml;gst vinst" metric="Resultat" entries={topProfit} />
        <RankingPreview title="Flest anst&auml;llda" metric="Anstallda" entries={topEmployees} />
      </section>
    </div>
  );
}

function RankingPreview({
  title,
  metric,
  entries,
}: {
  title: string;
  metric: string;
  entries: { org_number: string; name: string; value: number; period_end: string }[];
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        <Link
          href="/rankings"
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          Visa alla
        </Link>
      </div>
      <ol className="space-y-2">
        {entries.map((entry, i) => (
          <li key={entry.org_number}>
            <Link
              href={`/company/${entry.org_number}`}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <span className="w-6 text-center text-sm font-medium text-zinc-400">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {entry.name}
                </div>
                <div className="text-xs text-zinc-500">
                  {formatOrgNumber(entry.org_number)}
                </div>
              </div>
              <div className="text-sm font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
                {metric === "Anstallda"
                  ? Math.round(entry.value).toLocaleString("sv-SE")
                  : formatSEK(entry.value)}
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
