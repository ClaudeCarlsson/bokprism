import { notFound } from "next/navigation";
import { getPersonWithCompanies } from "@/lib/queries";
import { CompanyCard } from "@/components/CompanyCard";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const personId = parseInt(id, 10);
  if (isNaN(personId)) return { title: "Person - BokPrism" };
  const data = getPersonWithCompanies(personId);
  return {
    title: data
      ? `${data.person.first_name} ${data.person.last_name} - BokPrism`
      : "Person - BokPrism",
  };
}

export default async function PersonPage({ params }: Props) {
  const { id } = await params;
  const personId = parseInt(id, 10);
  if (isNaN(personId)) notFound();

  const data = getPersonWithCompanies(personId);
  if (!data) notFound();

  // Group by role
  const byRole = new Map<string, typeof data.companies>();
  for (const c of data.companies) {
    const existing = byRole.get(c.role) || [];
    existing.push(c);
    byRole.set(c.role, existing);
  }

  const roleOrder = ["Verkstellande direktor", "Styrelseordforande", "Styrelseledamot", "Suppleant"];
  const sortedRoles = [...byRole.keys()].sort((a, b) => {
    const ai = roleOrder.indexOf(a);
    const bi = roleOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl dark:text-zinc-100">
          {data.person.first_name} {data.person.last_name}
        </h1>
        <p className="mt-2 text-sm text-zinc-500 sm:text-base">
          {`Kopplad till ${data.companies.length} företagsroller hos ${new Set(data.companies.map(c => c.org_number)).size} företag`}
        </p>
      </header>

      {sortedRoles.map(role => {
        const companies = byRole.get(role)!;
        return (
          <section key={role} className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {role}
              <span className="ml-2 text-sm font-normal text-zinc-500">
                ({companies.length})
              </span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {companies.map(c => (
                <CompanyCard
                  key={`${c.org_number}-${c.role}`}
                  orgNumber={c.org_number}
                  name={c.name}
                  role={c.role}
                  periodEnd={c.period_end}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
