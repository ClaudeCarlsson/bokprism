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
  _statsCache = null;
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

// Some filings report only a sliver of the statutory accounts (e.g. old K2
// year-ends with just Nettoomsattning, or truncated filings missing the
// balance sheet entirely). Showing them alongside full-K3 years misleads more
// than it informs — charts jitter, subtotals show "–", ratios can't be
// computed. A period qualifies for display only if it has an income-statement
// line AND a balance-sheet line.
const INCOME_METRICS = [
  "RorelseintakterLagerforandringarMm",
  "Nettoomsattning",
  "ResultatEfterFinansiellaPoster",
  "AretsResultat",
  "Rorelseresultat",
];
const BALANCE_METRICS = ["Tillgangar", "EgetKapital"];

function isPeriodComplete(metrics: Record<string, number>): boolean {
  return (
    INCOME_METRICS.some(k => k in metrics) &&
    BALANCE_METRICS.some(k => k in metrics)
  );
}

// SQL equivalent of isPeriodComplete — assumes the filing id is addressable
// as `f2.id`. Used to filter search/rankings to displayable filings.
const COMPLETE_FILING_SQL = `
  EXISTS (SELECT 1 FROM financial_data WHERE filing_id = f2.id AND metric IN (
    '${INCOME_METRICS.join("','")}'
  ))
  AND EXISTS (SELECT 1 FROM financial_data WHERE filing_id = f2.id AND metric IN (
    '${BALANCE_METRICS.join("','")}'
  ))
`;

// ── Search ────────────────────────────────────────────────────────────

// Shared correlated subqueries for search result enrichment. The COALESCE on
// latest_revenue mirrors the K2 fallback in `applyMetricFallbacks`. Each
// subquery only considers filings that pass the completeness check so search
// results match what the company detail page will actually display.
const SEARCH_FIELDS = `
  c.org_number, c.name,
  COALESCE(
    (SELECT fd.value FROM financial_data fd JOIN filings f2 ON fd.filing_id = f2.id
     WHERE f2.org_number = c.org_number AND fd.metric = 'RorelseintakterLagerforandringarMm'
       AND f2.period_end >= @minPeriod AND ${COMPLETE_FILING_SQL}
     ORDER BY f2.period_end DESC LIMIT 1),
    (SELECT fd.value FROM financial_data fd JOIN filings f2 ON fd.filing_id = f2.id
     WHERE f2.org_number = c.org_number AND fd.metric = 'Nettoomsattning'
       AND f2.period_end >= @minPeriod AND ${COMPLETE_FILING_SQL}
     ORDER BY f2.period_end DESC LIMIT 1)
  ) as latest_revenue,
  (SELECT fd.value FROM financial_data fd JOIN filings f2 ON fd.filing_id = f2.id
   WHERE f2.org_number = c.org_number AND fd.metric = 'ResultatEfterFinansiellaPoster'
     AND f2.period_end >= @minPeriod AND ${COMPLETE_FILING_SQL}
   ORDER BY f2.period_end DESC LIMIT 1) as latest_profit,
  (SELECT f2.period_end FROM filings f2
   WHERE f2.org_number = c.org_number AND f2.period_end >= @minPeriod AND ${COMPLETE_FILING_SQL}
   ORDER BY f2.period_end DESC LIMIT 1) as latest_period,
  (SELECT COUNT(*) FROM filings f2
   WHERE f2.org_number = c.org_number AND f2.period_end >= @minPeriod AND ${COMPLETE_FILING_SQL}) as filing_count
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

// Batch-fetch metrics for many filings in one query. Beats N+1 for a company
// with 10+ filings; keeps the group-by-filing logic in JS where it belongs.
function loadFilingMetrics(
  d: Database.Database,
  filingIds: readonly number[]
): Map<number, Record<string, number>> {
  const out = new Map<number, Record<string, number>>();
  if (filingIds.length === 0) return out;
  for (const id of filingIds) out.set(id, {});
  const placeholders = filingIds.map(() => "?").join(",");
  const rows = d
    .prepare(
      `SELECT filing_id, metric, value FROM financial_data WHERE filing_id IN (${placeholders})`
    )
    .all(...filingIds) as { filing_id: number; metric: string; value: number }[];
  for (const row of rows) out.get(row.filing_id)![row.metric] = row.value;
  for (const metrics of out.values()) applyMetricFallbacks(metrics);
  return out;
}

export function getCompanyDetail(orgNumber: string): CompanyDetail | null {
  const d = db();

  const company = d
    .prepare("SELECT org_number, name FROM companies WHERE org_number = ?")
    .get(orgNumber) as { org_number: string; name: string } | undefined;
  if (!company) return null;

  const rawFilings = d
    .prepare(
      "SELECT id, org_number, period_start, period_end, currency, source_file FROM filings WHERE org_number = ? AND period_end >= ? ORDER BY period_end DESC"
    )
    .all(orgNumber, MIN_VALID_PERIOD_END) as CompanyDetail["filings"];

  const metricsById = loadFilingMetrics(d, rawFilings.map(f => f.id));

  const filings: CompanyDetail["filings"] = [];
  const history: FinancialHistory[] = [];
  let latestFinancials: Record<string, number> = {};
  let latestFilingId: number | null = null;

  for (const f of rawFilings) {
    const metrics = metricsById.get(f.id) ?? {};
    if (!isPeriodComplete(metrics)) continue;
    filings.push(f);
    history.push({ period_end: f.period_end, metrics });
    if (latestFilingId === null) {
      latestFilingId = f.id;
      latestFinancials = metrics;
    }
  }
  // Charts/tables want oldest-first; filings list stays newest-first.
  history.reverse();

  const texts: Record<string, string> = {};
  if (latestFilingId !== null) {
    const textRows = d
      .prepare("SELECT field, content FROM filing_texts WHERE filing_id = ?")
      .all(latestFilingId) as { field: string; content: string }[];
    for (const row of textRows) texts[row.field] = row.content;
  }

  return { company, filings, latestFinancials, history, texts };
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
          AND ${COMPLETE_FILING_SQL}
        ORDER BY f2.period_end DESC LIMIT 1
      )
    ORDER BY fd.value ${order === "asc" ? "ASC" : "DESC"}
    LIMIT ?
  `).all(metric, effectiveMinPeriod, effectiveMinPeriod, limit) as RankingEntry[];
}

// ── Site Stats ────────────────────────────────────────────────────────

// COUNT(*) over 109M rows in financial_data takes seconds. The stats change
// only when a new ingestion completes, so a per-process 1 hour cache is safe.
// Cache is invalidated whenever the underlying DB instance changes (see
// _setDbForTests) so tests never see stale values.
let _statsCache: { stats: SiteStats; expires: number; db: Database.Database } | null = null;
const STATS_TTL_MS = 60 * 60 * 1000;

export function getSiteStats(): SiteStats {
  const d = db();
  const now = Date.now();
  if (_statsCache && _statsCache.db === d && _statsCache.expires > now) {
    return _statsCache.stats;
  }
  const row = d
    .prepare(`
      SELECT
        (SELECT COUNT(*) FROM companies) AS total_companies,
        (SELECT COUNT(*) FROM filings) AS total_filings,
        (SELECT COUNT(*) FROM financial_data) AS total_data_points,
        (SELECT COUNT(*) FROM people) AS total_people,
        (SELECT MIN(substr(period_end, 1, 4)) FROM filings WHERE period_end >= ?) AS min_year,
        (SELECT MAX(substr(period_end, 1, 4)) FROM filings WHERE period_end >= ?) AS max_year
    `)
    .get(MIN_VALID_PERIOD_END, MIN_VALID_PERIOD_END) as {
      total_companies: number;
      total_filings: number;
      total_data_points: number;
      total_people: number;
      min_year: string;
      max_year: string;
    };
  const stats: SiteStats = {
    total_companies: row.total_companies,
    total_filings: row.total_filings,
    total_data_points: row.total_data_points,
    total_people: row.total_people,
    years_covered: `${row.min_year}–${row.max_year}`,
  };
  _statsCache = { stats, expires: now + STATS_TTL_MS, db: d };
  return stats;
}
