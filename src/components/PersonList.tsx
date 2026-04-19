"use client";

import Link from "next/link";
import type { CompanyRole } from "@/lib/types";

interface PersonListProps {
  people: CompanyRole[];
}

export function PersonList({ people }: PersonListProps) {
  if (people.length === 0) return null;

  // Deduplicate: show each person once with their latest role
  const uniquePeople = new Map<number, CompanyRole>();
  for (const p of people) {
    if (!uniquePeople.has(p.person_id)) {
      uniquePeople.set(p.person_id, p);
    }
  }

  const roleOrder: Record<string, number> = {
    "Verkställande direktör": 0,
    "Styrelseordförande": 1,
    "Styrelseledamot": 2,
    "Suppleant": 3,
    "Revisor": 4,
    "Auktoriserad revisor": 4,
  };

  const sorted = [...uniquePeople.values()].sort((a, b) => {
    const aOrder = roleOrder[a.role] ?? 10;
    const bOrder = roleOrder[b.role] ?? 10;
    return aOrder - bOrder || a.last_name.localeCompare(b.last_name, "sv");
  });

  return (
    <div>
      <h3 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Styrelse & Ledning
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {sorted.map(p => (
          <Link
            key={`${p.person_id}-${p.role}`}
            href={`/person/${p.person_id}`}
            className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            <div>
              <div className="font-medium text-zinc-900 dark:text-zinc-100">
                {p.first_name} {p.last_name}
              </div>
              <div className="text-sm text-zinc-500">{p.role}</div>
            </div>
            <svg
              className="h-4 w-4 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
