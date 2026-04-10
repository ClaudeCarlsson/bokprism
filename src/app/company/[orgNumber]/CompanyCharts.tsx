"use client";

import { RevenueChart, BalanceChart, ProfitabilityChart } from "@/components/FinancialChart";
import type { FinancialHistory } from "@/lib/types";

export function CompanyCharts({ history }: { history: FinancialHistory[] }) {
  if (history.length === 0) return <p className="text-zinc-500">Ingen historisk data.</p>;

  return (
    <>
      <RevenueChart history={history} />
      <BalanceChart history={history} />
      {history.length > 1 && <ProfitabilityChart history={history} />}
    </>
  );
}
