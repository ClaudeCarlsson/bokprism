// Deeper audit — percentiles for every major metric
import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(process.cwd(), "data", "bokprism.db"), { readonly: true });
db.pragma("cache_size = -128000");

function formatN(n: number): string {
  if (n === null || n === undefined) return "null";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e15) return `${sign}${(abs / 1e15).toFixed(1)}Q`;
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

// For each metric, compute percentiles
const allMetrics = (db.prepare("SELECT DISTINCT metric FROM financial_data").all() as { metric: string }[])
  .map(r => r.metric);

console.log(`Analyzing ${allMetrics.length} metrics...`);

// Show distribution for each significant metric
const keyMetrics = [
  "Nettoomsattning",
  "AretsResultat",
  "Rorelseresultat",
  "ResultatForeSkatt",
  "ResultatEfterFinansiellaPoster",
  "Tillgangar",
  "EgetKapital",
  "EgetKapitalSkulder",
  "Aktiekapital",
  "BalanseratResultat",
  "FrittEgetKapital",
  "KassaBankExklRedovisningsmedel",
  "KortfristigaSkulder",
  "LangfristigaSkulder",
  "Kundfordringar",
  "Leverantorsskulder",
  "Omsattningstillgangar",
  "Anlaggningstillgangar",
  "ByggnaderMark",
  "MateriellaAnlaggningstillgangar",
  "FinansiellaAnlaggningstillgangar",
  "Personalkostnader",
  "OvrigaExternaKostnader",
  "HandelsvarorKostnader",
  "AvskrivningarNedskrivningarMateriellaImmateriellaAnlaggningstillgangar",
  "Rorelsekostnader",
  "MedelantaletAnstallda",
  "Soliditet",
  "VarulagerMm",
  "KortfristigaFordringar",
  "ForslagDisposition",
  "ForslagDispositionBalanserasINyRakning",
  "ForslagDispositionUtdelning",
];

for (const metric of keyMetrics) {
  const stats = db.prepare(`
    SELECT COUNT(*) as cnt,
           MIN(value) as mn, MAX(value) as mx, AVG(value) as avg
    FROM financial_data WHERE metric = ?
  `).get(metric) as any;

  if (!stats.cnt) continue;

  // Percentiles via subquery
  const p = (pct: number) => {
    const offset = Math.floor(stats.cnt * pct);
    const row = db.prepare(
      "SELECT value FROM financial_data WHERE metric = ? ORDER BY value LIMIT 1 OFFSET ?"
    ).get(metric, offset) as { value: number } | undefined;
    return row?.value ?? 0;
  };

  const p001 = p(0.001);
  const p01 = p(0.01);
  const p50 = p(0.5);
  const p99 = p(0.99);
  const p999 = p(0.999);
  const p9999 = p(0.9999);

  console.log(`\n${metric} (n=${stats.cnt.toLocaleString()}):`);
  console.log(`  min=${formatN(stats.mn)} p0.1=${formatN(p001)} p1=${formatN(p01)} p50=${formatN(p50)} p99=${formatN(p99)} p99.9=${formatN(p999)} p99.99=${formatN(p9999)} max=${formatN(stats.mx)}`);
}

// Count records beyond sanity bounds
console.log("\n" + "=".repeat(80));
console.log("SANITY CHECK — records beyond proposed bounds");
console.log("=".repeat(80));

const bounds = [
  { metric: "MedelantaletAnstallda", max: 100_000, desc: "employees > 100K" },
  { metric: "MedelantaletAnstallda", max: null, min: 0, desc: "negative employees" },
  { metric: "Soliditet", max: 100, min: -100, desc: "soliditet outside [-100, 100]" },
  { metric: "Nettoomsattning", max: 1e12, desc: "revenue > 1 trillion SEK" },
  { metric: "Tillgangar", max: 1e12, desc: "assets > 1 trillion SEK" },
  { metric: "EgetKapital", max: 1e12, desc: "equity > 1 trillion SEK" },
  { metric: "ForslagDispositionBalanserasINyRakning", max: 1e11, desc: "forslag > 100B SEK" },
];

for (const b of bounds) {
  let q = "SELECT COUNT(*) as c FROM financial_data WHERE metric = ?";
  const params: any[] = [b.metric];
  if (b.max !== undefined && b.max !== null) {
    q += " AND value > ?";
    params.push(b.max);
  }
  if ((b as any).min !== undefined) {
    q += " AND value < ?";
    params.push((b as any).min);
  }
  const r = db.prepare(q).get(...params) as { c: number };
  console.log(`  ${b.desc}: ${r.c.toLocaleString()}`);
}

// Count any SEK metric with absolute value > 500B (half the GDP)
console.log("\nAny metric (non-percent/count) with |value| > 500B SEK:");
const bigValues = db.prepare(`
  SELECT metric, COUNT(*) as c, MAX(ABS(value)) as max_abs
  FROM financial_data
  WHERE metric NOT IN ('Soliditet', 'MedelantaletAnstallda')
  AND ABS(value) > 500e9
  GROUP BY metric
  ORDER BY c DESC
`).all() as any[];
for (const r of bigValues) {
  console.log(`  ${r.metric.padEnd(50)} ${r.c.toString().padStart(6)}  max: ${formatN(r.max_abs)}`);
}

db.close();
