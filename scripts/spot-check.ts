// Spot check for in-progress ingestion
import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(process.cwd(), "data", "bokprism.db"), { readonly: true });

function formatN(n: number): string {
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1e9) return `${s}${(a/1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${s}${(a/1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}${(a/1e3).toFixed(0)}K`;
  return `${s}${a.toFixed(0)}`;
}

const f = db.prepare("SELECT COUNT(*) as c FROM filings").get() as any;
const c = db.prepare("SELECT COUNT(*) as c FROM companies").get() as any;
const fd = db.prepare("SELECT COUNT(*) as c FROM financial_data").get() as any;
console.log(`Filings: ${f.c.toLocaleString()}  Companies: ${c.c.toLocaleString()}  Data: ${fd.c.toLocaleString()}`);

// Check for anomalies
const anomalies: Record<string, number> = {};

// Huge employees
anomalies.bigEmployees = (db.prepare(`
  SELECT COUNT(*) as c FROM financial_data
  WHERE metric = 'MedelantaletAnstallda' AND value > 200000
`).get() as any).c;

// Huge Soliditet
anomalies.bigSoliditet = (db.prepare(`
  SELECT COUNT(*) as c FROM financial_data
  WHERE metric = 'Soliditet' AND ABS(value) > 10
`).get() as any).c;

// Huge monetary
anomalies.bigMonetary = (db.prepare(`
  SELECT COUNT(*) as c FROM financial_data
  WHERE metric NOT IN ('MedelantaletAnstallda', 'Soliditet')
  AND ABS(value) > 1e12
`).get() as any).c;

// AretsResultat mismatches
anomalies.arMismatch = (db.prepare(`
  SELECT COUNT(*) as c FROM financial_data a
  JOIN financial_data b ON a.filing_id = b.filing_id
  WHERE a.metric = 'AretsResultat' AND b.metric = 'AretsResultatEgetKapital'
    AND ABS(a.value - b.value) > 1
`).get() as any).c;

// Big mismatches (> 1000x off)
anomalies.bigArMismatch = (db.prepare(`
  SELECT COUNT(*) as c FROM financial_data a
  JOIN financial_data b ON a.filing_id = b.filing_id
  WHERE a.metric = 'AretsResultat' AND b.metric = 'AretsResultatEgetKapital'
    AND (ABS(a.value) > ABS(b.value) * 100 OR ABS(b.value) > ABS(a.value) * 100)
    AND ABS(a.value) > 1 AND ABS(b.value) > 1
`).get() as any).c;

console.log("\nAnomalies (should all be 0):");
for (const [k, v] of Object.entries(anomalies)) {
  console.log(`  ${k}: ${v}`);
}

// Top 5 by key metrics
console.log("\nTop 5 revenue:");
const rev = db.prepare(`
  SELECT c.name, fd.value FROM financial_data fd
  JOIN filings f ON fd.filing_id = f.id
  JOIN companies c ON f.org_number = c.org_number
  WHERE fd.metric = 'Nettoomsattning' AND fd.value > 0
  ORDER BY fd.value DESC LIMIT 5
`).all() as any[];
for (const r of rev) console.log(`  ${formatN(r.value).padStart(8)}  ${r.name}`);

console.log("\nTop 5 employees:");
const emp = db.prepare(`
  SELECT c.name, fd.value FROM financial_data fd
  JOIN filings f ON fd.filing_id = f.id
  JOIN companies c ON f.org_number = c.org_number
  WHERE fd.metric = 'MedelantaletAnstallda'
  ORDER BY fd.value DESC LIMIT 5
`).all() as any[];
for (const r of emp) console.log(`  ${r.value.toString().padStart(8)}  ${r.name}`);

db.close();
