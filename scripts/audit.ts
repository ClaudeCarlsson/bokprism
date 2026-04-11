import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "bokprism.db");
const db = new Database(DB_PATH, { readonly: true });
db.pragma("cache_size = -128000");

function h(s: string) {
  console.log("\n" + "=".repeat(80));
  console.log(s);
  console.log("=".repeat(80));
}

function formatN(n: number): string {
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toFixed(0);
}

// ── 1. Basic counts ─────────────────────────────────────────────────
h("DATABASE OVERVIEW");
const tables = {
  companies: db.prepare("SELECT COUNT(*) as c FROM companies").get() as { c: number },
  filings: db.prepare("SELECT COUNT(*) as c FROM filings").get() as { c: number },
  financial_data: db.prepare("SELECT COUNT(*) as c FROM financial_data").get() as { c: number },
  people: db.prepare("SELECT COUNT(*) as c FROM people").get() as { c: number },
};
console.log(`Companies:      ${tables.companies.c.toLocaleString()}`);
console.log(`Filings:        ${tables.filings.c.toLocaleString()}`);
console.log(`Financial data: ${tables.financial_data.c.toLocaleString()}`);
console.log(`People:         ${tables.people.c.toLocaleString()}`);

// ── 2. Metric frequency ─────────────────────────────────────────────
h("TOP 30 MOST COMMON METRICS");
const metricFreq = db.prepare(`
  SELECT metric, COUNT(*) as cnt, AVG(value) as avg_val, MIN(value) as min_val, MAX(value) as max_val
  FROM financial_data
  GROUP BY metric
  ORDER BY cnt DESC
  LIMIT 30
`).all() as any[];
for (const r of metricFreq) {
  console.log(`${r.metric.padEnd(50)} ${r.cnt.toString().padStart(8)}  [${formatN(r.min_val)} .. ${formatN(r.max_val)}]`);
}

// ── 3. Employees — the suspected bug ────────────────────────────────
h("MEDELANTALET ANSTALLDA — DISTRIBUTION");
const empStats = db.prepare(`
  SELECT
    COUNT(*) as cnt,
    MIN(value) as mn,
    MAX(value) as mx,
    AVG(value) as avg
  FROM financial_data
  WHERE metric = 'MedelantaletAnstallda'
`).get() as any;
console.log(`Count: ${empStats.cnt.toLocaleString()}`);
console.log(`Min: ${empStats.mn}, Max: ${empStats.mx.toLocaleString()}, Avg: ${empStats.avg.toFixed(1)}`);

console.log("\nDistribution buckets (employee count):");
const buckets = db.prepare(`
  SELECT
    CASE
      WHEN value = 0 THEN '0'
      WHEN value <= 1 THEN '1'
      WHEN value <= 5 THEN '2-5'
      WHEN value <= 10 THEN '6-10'
      WHEN value <= 50 THEN '11-50'
      WHEN value <= 100 THEN '51-100'
      WHEN value <= 500 THEN '101-500'
      WHEN value <= 1000 THEN '501-1000'
      WHEN value <= 10000 THEN '1001-10K'
      WHEN value <= 100000 THEN '10K-100K'
      WHEN value <= 1000000 THEN '100K-1M'
      ELSE '>1M (BUG!)'
    END as bucket,
    COUNT(*) as cnt
  FROM financial_data
  WHERE metric = 'MedelantaletAnstallda'
  GROUP BY bucket
  ORDER BY MIN(value)
`).all() as any[];
for (const r of buckets) {
  console.log(`  ${r.bucket.padEnd(12)} ${r.cnt.toLocaleString()}`);
}

console.log("\nTop 20 companies by employee count:");
const topEmp = db.prepare(`
  SELECT c.name, c.org_number, fd.value, f.period_end
  FROM financial_data fd
  JOIN filings f ON fd.filing_id = f.id
  JOIN companies c ON f.org_number = c.org_number
  WHERE fd.metric = 'MedelantaletAnstallda'
  ORDER BY fd.value DESC
  LIMIT 20
`).all() as any[];
for (const r of topEmp) {
  console.log(`  ${r.value.toLocaleString().padStart(12)}  ${r.name} (${r.org_number}) [${r.period_end}]`);
}

// ── 4. Revenue — sanity check ───────────────────────────────────────
h("NETTOOMSATTNING — DISTRIBUTION");
const revStats = db.prepare(`
  SELECT
    COUNT(*) as cnt,
    MIN(value) as mn,
    MAX(value) as mx,
    AVG(value) as avg
  FROM financial_data
  WHERE metric = 'Nettoomsattning'
`).get() as any;
console.log(`Count: ${revStats.cnt.toLocaleString()}`);
console.log(`Min: ${formatN(revStats.mn)}, Max: ${formatN(revStats.mx)}, Avg: ${formatN(revStats.avg)}`);

console.log("\nTop 20 by revenue:");
const topRev = db.prepare(`
  SELECT c.name, c.org_number, fd.value, f.period_end
  FROM financial_data fd
  JOIN filings f ON fd.filing_id = f.id
  JOIN companies c ON f.org_number = c.org_number
  WHERE fd.metric = 'Nettoomsattning'
  ORDER BY fd.value DESC
  LIMIT 20
`).all() as any[];
for (const r of topRev) {
  console.log(`  ${formatN(r.value).padStart(10)}  ${r.name} (${r.org_number}) [${r.period_end}]`);
}

// Swedish GDP is ~600B USD ~= 6 trillion SEK. Any single company revenue > 500B SEK is suspect.
console.log("\nCompanies with revenue > 500 mdr SEK (suspect):");
const suspectRev = db.prepare(`
  SELECT c.name, c.org_number, fd.value, f.period_end
  FROM financial_data fd
  JOIN filings f ON fd.filing_id = f.id
  JOIN companies c ON f.org_number = c.org_number
  WHERE fd.metric = 'Nettoomsattning' AND fd.value > 500e9
  ORDER BY fd.value DESC
`).all() as any[];
console.log(`  Count: ${suspectRev.length}`);
for (const r of suspectRev.slice(0, 20)) {
  console.log(`  ${formatN(r.value).padStart(10)}  ${r.name} (${r.org_number}) [${r.period_end}]`);
}

// ── 5. Profit sanity ────────────────────────────────────────────────
h("ARETS RESULTAT — DISTRIBUTION");
const profitStats = db.prepare(`
  SELECT COUNT(*) as cnt, MIN(value) as mn, MAX(value) as mx
  FROM financial_data
  WHERE metric = 'AretsResultat'
`).get() as any;
console.log(`Count: ${profitStats.cnt.toLocaleString()}`);
console.log(`Min: ${formatN(profitStats.mn)}, Max: ${formatN(profitStats.mx)}`);

// ── 6. Total assets sanity ──────────────────────────────────────────
h("TILLGANGAR — DISTRIBUTION");
const assetStats = db.prepare(`
  SELECT COUNT(*) as cnt, MIN(value) as mn, MAX(value) as mx
  FROM financial_data
  WHERE metric = 'Tillgangar'
`).get() as any;
console.log(`Count: ${assetStats.cnt.toLocaleString()}`);
console.log(`Min: ${formatN(assetStats.mn)}, Max: ${formatN(assetStats.mx)}`);

console.log("\nTop 10 by total assets:");
const topAssets = db.prepare(`
  SELECT c.name, c.org_number, fd.value, f.period_end
  FROM financial_data fd
  JOIN filings f ON fd.filing_id = f.id
  JOIN companies c ON f.org_number = c.org_number
  WHERE fd.metric = 'Tillgangar'
  ORDER BY fd.value DESC
  LIMIT 10
`).all() as any[];
for (const r of topAssets) {
  console.log(`  ${formatN(r.value).padStart(10)}  ${r.name} (${r.org_number}) [${r.period_end}]`);
}

// ── 7. Soliditet sanity (should be 0..1 in our DB) ──────────────────
h("SOLIDITET — DISTRIBUTION");
const solStats = db.prepare(`
  SELECT COUNT(*) as cnt, MIN(value) as mn, MAX(value) as mx, AVG(value) as avg
  FROM financial_data
  WHERE metric = 'Soliditet'
`).get() as any;
console.log(`Count: ${solStats.cnt.toLocaleString()}`);
console.log(`Min: ${solStats.mn}, Max: ${solStats.mx}, Avg: ${solStats.avg?.toFixed(3)}`);
console.log("Expected range: -10..10 (can be negative if EK negative)");

const solBuckets = db.prepare(`
  SELECT
    CASE
      WHEN value < -1 THEN '< -1 (BUG?)'
      WHEN value < 0 THEN '-1..0 (neg equity)'
      WHEN value <= 0.1 THEN '0..10%'
      WHEN value <= 0.25 THEN '10..25%'
      WHEN value <= 0.5 THEN '25..50%'
      WHEN value <= 1 THEN '50..100%'
      WHEN value <= 10 THEN '100..1000%'
      ELSE '> 1000% (BUG!)'
    END as bucket,
    COUNT(*) as cnt
  FROM financial_data
  WHERE metric = 'Soliditet'
  GROUP BY bucket
  ORDER BY MIN(value)
`).all() as any[];
for (const r of solBuckets) {
  console.log(`  ${r.bucket.padEnd(22)} ${r.cnt.toLocaleString()}`);
}

// ── 8. Missing data check ───────────────────────────────────────────
h("MISSING DATA CHECK");
console.log("Filings that have NO Nettoomsattning value:");
const missingRev = db.prepare(`
  SELECT COUNT(*) as c FROM filings f
  WHERE NOT EXISTS (
    SELECT 1 FROM financial_data fd
    WHERE fd.filing_id = f.id AND fd.metric = 'Nettoomsattning'
  )
`).get() as any;
console.log(`  ${missingRev.c.toLocaleString()} of ${tables.filings.c.toLocaleString()} filings (${(missingRev.c / tables.filings.c * 100).toFixed(1)}%)`);

console.log("\nFilings with no metrics at all:");
const noMetrics = db.prepare(`
  SELECT COUNT(*) as c FROM filings f
  WHERE NOT EXISTS (SELECT 1 FROM financial_data fd WHERE fd.filing_id = f.id)
`).get() as any;
console.log(`  ${noMetrics.c.toLocaleString()} (${(noMetrics.c / tables.filings.c * 100).toFixed(2)}%)`);

console.log("\nCompanies with no name:");
const noName = db.prepare("SELECT COUNT(*) as c FROM companies WHERE name IS NULL OR name = ''").get() as any;
console.log(`  ${noName.c.toLocaleString()}`);

// ── 9. Metrics-per-filing distribution ──────────────────────────────
h("METRICS PER FILING DISTRIBUTION");
const perFiling = db.prepare(`
  SELECT
    CASE
      WHEN cnt = 0 THEN '0'
      WHEN cnt <= 10 THEN '1-10'
      WHEN cnt <= 25 THEN '11-25'
      WHEN cnt <= 50 THEN '26-50'
      WHEN cnt <= 100 THEN '51-100'
      ELSE '>100'
    END as bucket,
    COUNT(*) as filings
  FROM (
    SELECT filing_id, COUNT(*) as cnt
    FROM financial_data
    GROUP BY filing_id
  )
  GROUP BY bucket
  ORDER BY MIN(cnt)
`).all() as any[];
for (const r of perFiling) {
  console.log(`  ${r.bucket.padEnd(10)} ${r.filings.toLocaleString()} filings`);
}

// ── 10. Accounting equation check ───────────────────────────────────
h("ACCOUNTING EQUATION CHECK: Tillgangar == EgetKapitalSkulder");
const accEq = db.prepare(`
  SELECT COUNT(*) as c FROM (
    SELECT f.id
    FROM filings f
    JOIN financial_data fd1 ON fd1.filing_id = f.id AND fd1.metric = 'Tillgangar'
    JOIN financial_data fd2 ON fd2.filing_id = f.id AND fd2.metric = 'EgetKapitalSkulder'
    WHERE ABS(fd1.value - fd2.value) > 1
  )
`).get() as any;
console.log(`Filings where Tillgangar != EgetKapitalSkulder (by more than 1 SEK): ${accEq.c.toLocaleString()}`);

db.close();
