// Remove impossible values from the database.
// Mirrors the sanity bounds in scripts/parse-ixbrl.ts (isSane function).
import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(process.cwd(), "data", "bokprism.db"));
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("cache_size = -128000");

function count(sql: string, params: any[] = []): number {
  return (db.prepare(sql).get(...params) as { c: number }).c;
}

const before = count("SELECT COUNT(*) as c FROM financial_data");
console.log(`financial_data rows before cleanup: ${before.toLocaleString()}`);

console.log("\nIdentifying rows to delete...");

// Count violations in each category first
const ruleCounts = {
  negativeEmployees: count(`
    SELECT COUNT(*) as c FROM financial_data
    WHERE metric = 'MedelantaletAnstallda' AND value < 0
  `),
  tooManyEmployees: count(`
    SELECT COUNT(*) as c FROM financial_data
    WHERE metric = 'MedelantaletAnstallda' AND value > 200000
  `),
  badSoliditet: count(`
    SELECT COUNT(*) as c FROM financial_data
    WHERE metric = 'Soliditet' AND (value > 10 OR value < -10)
  `),
  extremeMonetary: count(`
    SELECT COUNT(*) as c FROM financial_data
    WHERE metric NOT IN ('MedelantaletAnstallda', 'Soliditet')
    AND ABS(value) > 1e12
  `),
};

console.log("\nRule violations:");
console.log(`  Negative employees:                ${ruleCounts.negativeEmployees}`);
console.log(`  Employees > 200,000:               ${ruleCounts.tooManyEmployees}`);
console.log(`  Soliditet outside [-10, 10]:       ${ruleCounts.badSoliditet}`);
console.log(`  Monetary values > 1 trillion SEK:  ${ruleCounts.extremeMonetary}`);

const total = Object.values(ruleCounts).reduce((a, b) => a + b, 0);
console.log(`  Total to delete:                   ${total}`);

// Show samples of what we're deleting
console.log("\nSample records to be deleted:");
const samples = db.prepare(`
  SELECT c.name, c.org_number, fd.metric, fd.value, f.period_end
  FROM financial_data fd
  JOIN filings f ON fd.filing_id = f.id
  JOIN companies c ON f.org_number = c.org_number
  WHERE (fd.metric = 'MedelantaletAnstallda' AND (fd.value < 0 OR fd.value > 200000))
     OR (fd.metric = 'Soliditet' AND (fd.value > 10 OR fd.value < -10))
     OR (fd.metric NOT IN ('MedelantaletAnstallda', 'Soliditet') AND ABS(fd.value) > 1e12)
  ORDER BY ABS(fd.value) DESC
  LIMIT 20
`).all() as any[];

for (const s of samples) {
  console.log(`  ${s.metric}=${s.value}  ${s.name} (${s.org_number}) [${s.period_end}]`);
}

// Execute the cleanup in a single transaction
console.log("\nExecuting cleanup...");
const t0 = Date.now();

const result = db.transaction(() => {
  const r1 = db.prepare(`
    DELETE FROM financial_data
    WHERE metric = 'MedelantaletAnstallda' AND (value < 0 OR value > 200000)
  `).run();
  const r2 = db.prepare(`
    DELETE FROM financial_data
    WHERE metric = 'Soliditet' AND (value > 10 OR value < -10)
  `).run();
  const r3 = db.prepare(`
    DELETE FROM financial_data
    WHERE metric NOT IN ('MedelantaletAnstallda', 'Soliditet')
    AND ABS(value) > 1e12
  `).run();
  return {
    employees: r1.changes,
    soliditet: r2.changes,
    monetary: r3.changes,
  };
})();

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\nDeleted in ${elapsed}s:`);
console.log(`  Employee records:  ${result.employees}`);
console.log(`  Soliditet records: ${result.soliditet}`);
console.log(`  Monetary records:  ${result.monetary}`);
console.log(`  Total:             ${result.employees + result.soliditet + result.monetary}`);

const after = count("SELECT COUNT(*) as c FROM financial_data");
console.log(`\nfinancial_data rows after cleanup: ${after.toLocaleString()}`);
console.log(`Net removed: ${(before - after).toLocaleString()}`);

// Verify no more bad data
console.log("\nVerifying...");
const check1 = count(`
  SELECT COUNT(*) as c FROM financial_data
  WHERE metric = 'MedelantaletAnstallda' AND (value < 0 OR value > 200000)
`);
const check2 = count(`
  SELECT COUNT(*) as c FROM financial_data
  WHERE metric = 'Soliditet' AND (value > 10 OR value < -10)
`);
const check3 = count(`
  SELECT COUNT(*) as c FROM financial_data
  WHERE metric NOT IN ('MedelantaletAnstallda', 'Soliditet')
  AND ABS(value) > 1e12
`);
console.log(`  Bad employees remaining:  ${check1}`);
console.log(`  Bad soliditet remaining:  ${check2}`);
console.log(`  Bad monetary remaining:   ${check3}`);

// Show new top employees (sanity check)
console.log("\nNew top 10 by employees:");
const topEmp = db.prepare(`
  SELECT c.name, c.org_number, fd.value, f.period_end
  FROM financial_data fd
  JOIN filings f ON fd.filing_id = f.id
  JOIN companies c ON f.org_number = c.org_number
  WHERE fd.metric = 'MedelantaletAnstallda'
  ORDER BY fd.value DESC
  LIMIT 10
`).all() as any[];
for (const r of topEmp) {
  console.log(`  ${r.value.toLocaleString().padStart(8)}  ${r.name} (${r.org_number})`);
}

db.close();
console.log("\nDone.");
