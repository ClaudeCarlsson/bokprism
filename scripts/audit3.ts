// Broader sanity check: look for internal inconsistencies
import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(process.cwd(), "data", "bokprism.db"), { readonly: true });
db.pragma("cache_size = -128000");

function hr() { console.log("\n" + "=".repeat(80)); }

function n(x: number): string {
  if (Math.abs(x) >= 1e9) return `${(x/1e9).toFixed(1)}B`;
  if (Math.abs(x) >= 1e6) return `${(x/1e6).toFixed(1)}M`;
  if (Math.abs(x) >= 1e3) return `${(x/1e3).toFixed(0)}K`;
  return x.toFixed(0);
}

hr();
console.log("INTERNAL CONSISTENCY CHECKS");

// Revenue - costs should roughly equal operating profit
console.log("\nFilings where Nettoomsattning > 10 * Tillgangar (suspect):");
const r1 = db.prepare(`
  SELECT c.name, c.org_number, rev.value as rev, t.value as assets, f.period_end
  FROM financial_data rev
  JOIN financial_data t ON t.filing_id = rev.filing_id AND t.metric = 'Tillgangar'
  JOIN filings f ON rev.filing_id = f.id
  JOIN companies c ON f.org_number = c.org_number
  WHERE rev.metric = 'Nettoomsattning'
    AND rev.value > 100e6
    AND rev.value > 10 * t.value
    AND t.value > 0
  ORDER BY rev.value DESC
  LIMIT 10
`).all() as any[];
for (const r of r1) {
  console.log(`  rev=${n(r.rev)} assets=${n(r.assets)} ratio=${(r.rev/r.assets).toFixed(1)}x  ${r.name} (${r.org_number}) [${r.period_end}]`);
}

// Companies where profit > revenue (suspect unless holding)
console.log("\nFilings where AretsResultat > Nettoomsattning * 2 (suspect):");
const r2 = db.prepare(`
  SELECT c.name, c.org_number, profit.value as profit, rev.value as rev, f.period_end
  FROM financial_data profit
  JOIN financial_data rev ON rev.filing_id = profit.filing_id AND rev.metric = 'Nettoomsattning'
  JOIN filings f ON profit.filing_id = f.id
  JOIN companies c ON f.org_number = c.org_number
  WHERE profit.metric = 'AretsResultat'
    AND profit.value > 1e9
    AND rev.value > 1e6
    AND profit.value > rev.value * 2
  ORDER BY profit.value DESC
  LIMIT 10
`).all() as any[];
for (const r of r2) {
  console.log(`  profit=${n(r.profit)} rev=${n(r.rev)}  ${r.name} (${r.org_number}) [${r.period_end}]`);
}

// Negative revenue
console.log("\nFilings with negative revenue (< -10M SEK):");
const r3 = db.prepare(`
  SELECT c.name, c.org_number, fd.value, f.period_end
  FROM financial_data fd
  JOIN filings f ON fd.filing_id = f.id
  JOIN companies c ON f.org_number = c.org_number
  WHERE fd.metric = 'Nettoomsattning' AND fd.value < -10e6
  ORDER BY fd.value
  LIMIT 10
`).all() as any[];
for (const r of r3) {
  console.log(`  ${n(r.value)}  ${r.name} (${r.org_number}) [${r.period_end}]`);
}

// Filings where AretsResultat == AretsResultatEgetKapital (should be equal)
console.log("\nFilings where AretsResultat != AretsResultatEgetKapital:");
const r4 = db.prepare(`
  SELECT COUNT(*) as c FROM financial_data a
  JOIN financial_data b ON a.filing_id = b.filing_id
  WHERE a.metric = 'AretsResultat' AND b.metric = 'AretsResultatEgetKapital'
    AND ABS(a.value - b.value) > 1
`).get() as any;
console.log(`  ${r4.c.toLocaleString()} filings`);

// Currency check - anything non-SEK
console.log("\nFiling currencies distribution:");
const curr = db.prepare(`SELECT currency, COUNT(*) as c FROM filings GROUP BY currency`).all();
for (const r of curr as any[]) console.log(`  ${r.currency}: ${r.c.toLocaleString()}`);

// Companies with too many filings (> 10 for same period — duplication?)
console.log("\nOrg numbers with multiple filings for same period:");
const dup = db.prepare(`
  SELECT org_number, period_end, COUNT(*) as c
  FROM filings
  GROUP BY org_number, period_end
  HAVING c > 1
  ORDER BY c DESC
  LIMIT 10
`).all() as any[];
for (const r of dup) console.log(`  ${r.org_number} ${r.period_end}: ${r.c}`);
if (dup.length === 0) console.log("  none (UNIQUE constraint working)");

// Missing org number check
console.log("\nFilings with invalid org numbers:");
const bad = db.prepare(`
  SELECT org_number, COUNT(*) as c FROM filings
  WHERE org_number NOT LIKE '%-%'
    OR LENGTH(org_number) != 11
  GROUP BY org_number
  LIMIT 10
`).all() as any[];
for (const r of bad) console.log(`  "${r.org_number}" (${r.c})`);

// Nettoomsattning per filing year distribution
console.log("\nRevenue > 0 by fiscal year:");
const byYear = db.prepare(`
  SELECT substr(f.period_end, 1, 4) as year,
         COUNT(*) as n,
         AVG(fd.value) as avg_rev,
         MAX(fd.value) as max_rev
  FROM filings f
  JOIN financial_data fd ON fd.filing_id = f.id AND fd.metric = 'Nettoomsattning'
  WHERE fd.value > 0
  GROUP BY year
  ORDER BY year
`).all() as any[];
for (const r of byYear) {
  console.log(`  ${r.year}: ${r.n.toLocaleString().padStart(8)} filings, avg=${n(r.avg_rev)}, max=${n(r.max_rev)}`);
}

db.close();
