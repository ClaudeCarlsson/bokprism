import Link from "next/link";
import { formatSEK, formatOrgNumber } from "@/lib/format";

interface CompanyCardProps {
  orgNumber: string;
  name: string;
  revenue?: number | null;
  profit?: number | null;
  role?: string;
  periodEnd?: string;
}

export function CompanyCard({
  orgNumber,
  name,
  revenue,
  profit,
  role,
  periodEnd,
}: CompanyCardProps) {
  return (
    <Link
      href={`/company/${orgNumber}`}
      className="block rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-blue-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-700"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{name}</h3>
          <p className="mt-1 text-sm text-zinc-500">{formatOrgNumber(orgNumber)}</p>
          {role && (
            <p className="mt-1 text-sm text-blue-600 dark:text-blue-400">{role}</p>
          )}
        </div>
        <div className="ml-4 text-right text-sm">
          {revenue != null && (
            <div className="text-zinc-600 dark:text-zinc-400">
              Oms: {formatSEK(revenue)}
            </div>
          )}
          {profit != null && (
            <div className={profit >= 0 ? "text-emerald-600" : "text-red-500"}>
              Res: {formatSEK(profit)}
            </div>
          )}
          {periodEnd && (
            <div className="mt-1 text-xs text-zinc-400">{periodEnd}</div>
          )}
        </div>
      </div>
    </Link>
  );
}
