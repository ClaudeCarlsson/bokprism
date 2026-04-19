import Database from "better-sqlite3";
import { getDb } from "./db";
import type {
  SearchResult,
  CompanyDetail,
  FinancialHistory,
  CompanyRole,
  PersonWithCompanies,
  RankingEntry,
  SiteStats,
} from "./types";

let _db: Database.Database | null = null;

function db(): Database.Database {
  if (!_db) {
    _db = getDb();
  }
  return _db;
}

/** Test-only: inject an in-memory DB without hitting the disk file. */
export function _setDbForTests(instance: Database.Database | null): void {
  _db = instance;
}

// iXBRL ingests occasionally carry sentinel dates like 1899-12-30 or 0001-01-01
// from opening-balance periods. Bolagsverket iXBRL filings started in 2015; any
// period_end before that is a parse artifact, not a real fiscal year.
const MIN_VALID_PERIOD_END = "2015-01-01";

// Older K2 filings report only `Nettoomsattning` and skip the
// `RorelseintakterLagerforandringarMm` subtotal we use as headline "Omsättning".
// Fall back so UI doesn't render 0 for years where the subtotal wasn't submitted.
function applyMetricFallbacks(metrics: Record<string, number>): void {
  const headline = metrics.RorelseintakterLagerforandringarMm;
  if ((headline == null || headline === 0) && metrics.Nettoomsattning) {
    metrics.RorelseintakterLagerforandringarMm = metrics.Nettoomsattning;
  }
}

// ── Search ────────────────────────────────────────────────────────────

// Shared correlated subqueries for search result enrichment. The COALESCE on
// latest_revenue mirrors the K2 fallback in `applyMetricFallbacks`.
const SEARCH_FIELDS = `
  c.org_number, c.name,
  COALESCE(
    (SELECT fd.value FROM financial_data fd JOIN filings f2 ON fd.filing_id = f2.id
     WHERE f2.org_number = c.org_number AND fd.metric = 'RorelseintakterLagerforandringarMm'
       AND f2.period_end >= @minPeriod
     ORDER BY f2.period_end DESC LIMIT 1),
    (SELECT fd.value FROM financial_data fd JOIN filings f2 ON fd.filing_id = f2.id
     WHERE f2.org_number = c.org_number AND fd.metric = 'Nettoomsattning'
       AND f2.period_end >= @minPeriod
     ORDER BY f2.period_end DESC LIMIT 1)
  ) as latest_revenue,
  (SELECT fd.value FROM financial_data fd JOIN filings f2 ON fd.filing_id = f2.id
   WHERE f2.org_number = c.org_number AND fd.metric = 'ResultatEfterFinansiellaPoster'
     AND f2.period_end >= @minPeriod
   ORDER BY f2.period_end DESC LIMIT 1) as latest_profit,
  (SELECT f2.period_end FROM filings f2
   WHERE f2.org_number = c.org_number AND f2.period_end >= @minPeriod
   ORDER BY f2.period_end DESC LIMIT 1) as latest_period,
  (SELECT COUNT(*) FROM filings f2
   WHERE f2.org_number = c.org_number AND f2.period_end >= @minPeriod) as filing_count
`;

export function searchCompanies(query: string, limit = 20): SearchResult[] {
  const d = db();
  const trimmed = query.trim();
  const isOrgNumber = /^\d{6}[-\s]?\d{4}$/.test(trimmed);

  if (isOrgNumber) {
    const normalized = trimmed.replace(/\D/g, "");
    const orgLike = `${normalized.slice(0, 6)}-${normalized.slice(6)}`;
    return d.prepare(`
      SELECT ${SEARCH_FIELDS}
      FROM companies c
      WHERE c.org_number = @org
      LIMIT @limit
    `).all({ org: orgLike, limit, minPeriod: MIN_VALID_PERIOD_END }) as SearchResult[];
  }

  const ftsQuery = trimmed.split(/\s+/).map(w => `"${w}"*`).join(" ");
  return d.prepare(`
    SELECT ${SEARCH_FIELDS}
    FROM companies_fts fts
    JOIN companies c ON c.org_number = fts.org_number
    WHERE companies_fts MATCH @fts
    ORDER BY rank
    LIMIT @limit
  `).all({ fts: ftsQuery, limit, minPeriod: MIN_VALID_PERIOD_END }) as SearchResult[];
}

// ── Company Detail ────────────────────────────────────────────────────

export function getCompanyDetail(orgNumber: string): CompanyDetail | null {
  const d = db();

  const company = d.prepare("SELECT org_number, name FROM companies WHERE org_number = ?")
    .get(orgNumber) as { org_number: string; name: string } | undefined;
  if (!company) return null;

  const filings = d.prepare(
    "SELECT id, org_number, period_start, period_end, currency, source_file FROM filings WHERE org_number = ? AND period_end >= ? ORDER BY period_end DESC"
  ).all(orgNumber, MIN_VALID_PERIOD_END) as CompanyDetail["filings"];

  const latestFiling = filings[0];
  const latestFinancials: Record<string, number> = {};
  const texts: Record<string, string> = {};

  if (latestFiling) {
    const rows = d.prepare(
      "SELECT metric, value FROM financial_data WHERE filing_id = ?"
    ).all(latestFiling.id) as { metric: string; value: number }[];
    for (const row of rows) {
      latestFinancials[row.metric] = row.value;
    }
    applyMetricFallbacks(latestFinancials);

    const textRows = d.prepare(
      "SELECT field, content FROM filing_texts WHERE filing_id = ?"
    ).all(latestFiling.id) as { field: string; content: string }[];
    for (const row of textRows) {
      texts[row.field] = row.content;
    }
  }

  return { company, filings, latestFinancials, texts };
}

// ── Financial History ─────────────────────────────────────────────────

export function getFinancialHistory(orgNumber: string): FinancialHistory[] {
  const d = db();

  const filings = d.prepare(
    "SELECT id, period_end FROM filings WHERE org_number = ? AND period_end >= ? ORDER BY period_end ASC"
  ).all(orgNumber, MIN_VALID_PERIOD_END) as { id: number; period_end: string }[];

  const getMetrics = d.prepare(
    "SELECT metric, value FROM financial_data WHERE filing_id = ?"
  );

  return filings.map(f => {
    const rows = getMetrics.all(f.id) as { metric: string; value: number }[];
    const metrics: Record<string, number> = {};
    for (const row of rows) {
      metrics[row.metric] = row.value;
    }
    applyMetricFallbacks(metrics);
    return { period_end: f.period_end, metrics };
  });
}

// ── Company People ────────────────────────────────────────────────────

export function getCompanyPeople(orgNumber: string): CompanyRole[] {
  const d = db();
  return d.prepare(`
    SELECT DISTINCT p.id as person_id, p.first_name, p.last_name, cr.role,
           f.period_end as filing_period_end
    FROM company_roles cr
    JOIN people p ON cr.person_id = p.id
    JOIN filings f ON cr.filing_id = f.id
    WHERE f.org_number = ? AND f.period_end >= ?
    ORDER BY f.period_end DESC, p.last_name, p.first_name
  `).all(orgNumber, MIN_VALID_PERIOD_END) as CompanyRole[];
}

// ── Person Detail ─────────────────────────────────────────────────────

export function getPersonWithCompanies(personId: number): PersonWithCompanies | null {
  const d = db();

  const person = d.prepare("SELECT id, first_name, last_name FROM people WHERE id = ?")
    .get(personId) as { id: number; first_name: string; last_name: string } | undefined;
  if (!person) return null;

  const companies = d.prepare(`
    SELECT c.org_number, c.name, cr.role,
           MAX(f.period_end) as period_end
    FROM company_roles cr
    JOIN filings f ON cr.filing_id = f.id
    JOIN companies c ON f.org_number = c.org_number
    WHERE cr.person_id = ? AND f.period_end >= ?
    GROUP BY c.org_number, cr.role
    ORDER BY period_end DESC, c.name
  `).all(personId, MIN_VALID_PERIOD_END) as PersonWithCompanies["companies"];

  return { person, companies };
}

// ── Rankings ──────────────────────────────────────────────────────────

export function getRankings(
  metric: string,
  order: "asc" | "desc" = "desc",
  limit = 50,
  minPeriod?: string
): RankingEntry[] {
  const d = db();
  const effectiveMinPeriod = minPeriod && minPeriod > MIN_VALID_PERIOD_END
    ? minPeriod
    : MIN_VALID_PERIOD_END;

  return d.prepare(`
    SELECT c.org_number, c.name, fd.value, f.period_end
    FROM financial_data fd
    JOIN filings f ON fd.filing_id = f.id
    JOIN companies c ON f.org_number = c.org_number
    WHERE fd.metric = ?
      AND f.period_end >= ?
      AND fd.value != 0
      AND f.id = (
        SELECT f2.id FROM filings f2
        WHERE f2.org_number = f.org_number AND f2.period_end >= ?
        ORDER BY f2.period_end DESC LIMIT 1
      )
    ORDER BY fd.value ${order === "asc" ? "ASC" : "DESC"}
    LIMIT ?
  `).all(metric, effectiveMinPeriod, effectiveMinPeriod, limit) as RankingEntry[];
}

// ── Site Stats ────────────────────────────────────────────────────────

export function getSiteStats(): SiteStats {
  const d = db();
  const companies = (d.prepare("SELECT COUNT(*) as c FROM companies").get() as { c: number }).c;
  const filings = (d.prepare("SELECT COUNT(*) as c FROM filings").get() as { c: number }).c;
  const dataPoints = (d.prepare("SELECT COUNT(*) as c FROM financial_data").get() as { c: number }).c;
  const people = (d.prepare("SELECT COUNT(*) as c FROM people").get() as { c: number }).c;

  const years = d.prepare(`
    SELECT MIN(substr(period_end, 1, 4)) as min_year,
           MAX(substr(period_end, 1, 4)) as max_year
    FROM filings
    WHERE period_end >= ?
  `).get(MIN_VALID_PERIOD_END) as { min_year: string; max_year: string };

  return {
    total_companies: companies,
    total_filings: filings,
    total_data_points: dataPoints,
    total_people: people,
    years_covered: `${years.min_year}–${years.max_year}`,
  };
}
