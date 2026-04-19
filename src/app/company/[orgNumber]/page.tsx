import { notFound } from "next/navigation";
import { getCompanyDetail, getCompanyPeople } from "@/lib/queries";
import { formatOrgNumber, formatPeriod } from "@/lib/format";
import { KEY_METRICS } from "@/lib/types";
import { MetricCard } from "@/components/MetricCard";
import { PersonList } from "@/components/PersonList";
import { Tabs } from "@/components/Tabs";
import { CompanyCharts } from "./CompanyCharts";
import { IncomeStatement, BalanceSheet } from "@/components/FinancialTable";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ orgNumber: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orgNumber } = await params;
  const detail = getCompanyDetail(orgNumber);
  return {
    title: detail ? `${detail.company.name} - BokPrism` : "Foretag - BokPrism",
  };
}

export default async function CompanyPage({ params }: Props) {
  const { orgNumber } = await params;
  const detail = getCompanyDetail(orgNumber);
  if (!detail) notFound();

  const people = getCompanyPeople(orgNumber);
  const { history } = detail;
  const latestFiling = detail.filings[0];
  const previousFinancials: Record<string, number> =
    history.length >= 2 ? history[history.length - 2].metrics : {};

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
      {/* Header */}
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-100">
          {detail.company.name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
          <span>{formatOrgNumber(detail.company.org_number)}</span>
          {latestFiling ? (
            <>
              <span className="text-zinc-300 dark:text-zinc-600">|</span>
              <span>Senaste bokslut: {formatPeriod(latestFiling.period_end)}</span>
              <span className="text-zinc-300 dark:text-zinc-600">|</span>
              <span>{detail.filings.length} bokslut</span>
            </>
          ) : (
            <>
              <span className="text-zinc-300 dark:text-zinc-600">|</span>
              <span className="text-amber-600 dark:text-amber-400">
                Ingen fullständig årsredovisning
              </span>
            </>
          )}
        </div>
        {detail.texts.verksamhet && (
          <p className="mt-4 max-w-3xl text-sm text-zinc-600 sm:text-base dark:text-zinc-400">
            {detail.texts.verksamhet.slice(0, 500)}
            {detail.texts.verksamhet.length > 500 ? "..." : ""}
          </p>
        )}
      </header>

      {/* Key Metrics */}
      <section className="mb-6 grid grid-cols-2 gap-2 sm:mb-8 sm:grid-cols-4 sm:gap-3 lg:grid-cols-8">
        {KEY_METRICS.map(metric => (
          <MetricCard
            key={metric}
            metric={metric}
            value={detail.latestFinancials[metric] ?? null}
            previousValue={previousFinancials[metric]}
            compact
          />
        ))}
      </section>

      {/* Tabbed Content */}
      <Tabs
        tabs={[
          {
            id: "overview",
            label: "Oversikt",
            content: (
              <div className="grid gap-8 lg:grid-cols-2">
                <CompanyCharts history={history} />
              </div>
            ),
          },
          {
            id: "income",
            label: "Resultat",
            content: <IncomeStatement history={history} />,
          },
          {
            id: "balance",
            label: "Balans",
            content: <BalanceSheet history={history} />,
          },
          {
            id: "people",
            label: `Styrelse (${new Set(people.map(p => p.person_id)).size})`,
            content: <PersonList people={people} />,
          },
          ...(detail.texts.vasentliga_handelser
            ? [
                {
                  id: "events",
                  label: "Handelser",
                  content: (
                    <div className="prose max-w-none dark:prose-invert">
                      <h3>Vasentliga handelser</h3>
                      <p className="whitespace-pre-line">{detail.texts.vasentliga_handelser}</p>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
