// Delete employee counts that fail a sanity cross-check with revenue.
// Real companies with 100+ employees have at least 100K SEK revenue per employee
// (that's the minimum to even cover payroll).
import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(process.cwd(), "data", "bokprism.db"));
db.pragma("journal_mode = WAL");

// Preview first
console.log("Preview: employee records to delete based on revenue cross-check\n");
console.log("Rule: employees >= 100 AND (no revenue OR revenue/employee < 30,000 SEK)\n");

const preview = db.prepare(`
  SELECT
    c.name,
    c.org_number,
    emp.value as employees,
    rev.value as revenue,
    f.period_end
  FROM financial_data emp
  JOIN filings f ON emp.filing_id = f.id
  JOIN companies c ON f.org_number = c.org_number
  LEFT JOIN financial_data rev ON rev.filing_id = f.id AND rev.metric = 'Nettoomsattning'
  WHERE emp.metric = 'MedelantaletAnstallda'
    AND emp.value >= 100
    AND (rev.value IS NULL OR rev.value < 30000 * emp.value)
  ORDER BY emp.value DESC
`).all() as any[];

console.log(`${preview.length} records flagged:`);
for (const r of preview) {
  const revStr = r.revenue != null ? `${(r.revenue / 1e6).toFixed(1)}M SEK` : "no revenue";
  console.log(`  ${r.employees.toString().padStart(6)} emp  ${revStr.padStart(12)}  ${r.name} (${r.org_number}) [${r.period_end}]`);
}

if (preview.length === 0) {
  console.log("Nothing to delete.");
  db.close();
  process.exit(0);
}

// Delete them
console.log("\nDeleting...");
const del = db.prepare(`
  DELETE FROM financial_data
  WHERE metric = 'MedelantaletAnstallda'
    AND value >= 100
    AND filing_id IN (
      SELECT f.id FROM filings f
      LEFT JOIN financial_data rev ON rev.filing_id = f.id AND rev.metric = 'Nettoomsattning'
      LEFT JOIN financial_data emp ON emp.filing_id = f.id AND emp.metric = 'MedelantaletAnstallda'
      WHERE emp.value >= 100
        AND (rev.value IS NULL OR rev.value < 30000 * emp.value)
    )
`).run();

console.log(`Deleted ${del.changes} records`);

// Verify new top 20
console.log("\nNew top 20 by employees:");
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
  console.log(`  ${r.value.toLocaleString().padStart(6)}  ${r.name} (${r.org_number}) [${r.period_end}]`);
}

db.close();
