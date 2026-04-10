"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface RankingSelectorProps {
  metrics: { key: string; label: string }[];
  currentMetric: string;
  currentOrder: string;
}

export function RankingSelector({ metrics, currentMetric, currentOrder }: RankingSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`/rankings?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        Rangordna efter:
      </label>
      <div className="flex flex-wrap gap-2">
        {metrics.map(m => (
          <button
            key={m.key}
            onClick={() => update("metric", m.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              currentMetric === m.key
                ? "bg-blue-600 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => update("order", currentOrder === "desc" ? "asc" : "desc")}
        className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        {currentOrder === "desc" ? "Fallande" : "Stigande"}
      </button>
    </div>
  );
}
