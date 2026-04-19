import Database from "better-sqlite3";
import { getDb, initSchema } from "../src/lib/db";
import { parseIxbrl, ParsedFiling } from "./parse-ixbrl";
import AdmZip from "adm-zip";
import { spawnSync, spawn } from "child_process";
import { existsSync, mkdirSync, unlinkSync, rmSync, readdirSync, statSync } from "fs";
import path from "path";

const BASE_URL = "https://vardefulla-datamangder.bolagsverket.se/arsredovisningar-bulkfiler";
const DATA_DIR = path.join(process.cwd(), "data");
const TEMP_DIR = path.join(DATA_DIR, "tmp");

// ── List all available zip files from the API ─────────────────────────

async function listAllFiles(): Promise<string[]> {
  const files: string[] = [];
  let marker = "";

  while (true) {
    const url = `${BASE_URL}?prefix=arsredovisningar/&delimiter=\\&max-keys=10000${marker ? `&marker=${marker}` : ""}`;
    const resp = await fetch(url);
    const xml = await resp.text();

    const keyRegex = /<Key>([^<]+)<\/Key>/g;
    let match;
    while ((match = keyRegex.exec(xml)) !== null) {
      if (match[1].endsWith(".zip")) {
        files.push(match[1]);
      }
    }

    const truncated = /<IsTruncated>true<\/IsTruncated>/i.test(xml);
    if (!truncated) break;

    const markerMatch = xml.match(/<NextMarker>([^<]+)<\/NextMarker>/);
    if (!markerMatch) break;
    marker = markerMatch[1].replace(/\[.*\]$/, "");
  }

  return files.sort();
}

// ── Download a file (returns a promise) ───────────────────────────────

function downloadFile(fileKey: string, destPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const url = `${BASE_URL}/${fileKey}`;
    const proc = spawn("curl", ["-sL", "-o", destPath, url], { stdio: "pipe" });
    const timeout = setTimeout(() => { proc.kill(); resolve(false); }, 300000);
    proc.on("close", (code) => {
      clearTimeout(timeout);
      resolve(code === 0 && existsSync(destPath));
    });
    proc.on("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

// ── Process a single outer zip file ───────────────────────────────────

function processOuterZip(db: Database.Database, zipPath: string, fileKey: string): number {
  let companiesProcessed = 0;
  let errors = 0;

  const extractDir = path.join(TEMP_DIR, "extract");
  mkdirSync(extractDir, { recursive: true });

  const unzip = spawnSync("unzip", ["-o", "-q", zipPath, "-d", extractDir], { stdio: "pipe" });
  if (unzip.status !== 0) {
    console.error(`  Failed to extract ${fileKey}:`, unzip.stderr.toString().trim());
    return 0;
  }

  const innerZips = readdirSync(extractDir).filter(f => f.endsWith(".zip"));

  // Prepared statements
  const stmts = {
    upsertCompany: db.prepare(`INSERT INTO companies (org_number, name) VALUES (?, ?) ON CONFLICT(org_number) DO UPDATE SET name = excluded.name`),
    upsertFiling: db.prepare(`INSERT INTO filings (org_number, period_start, period_end, currency, source_file) VALUES (?, ?, ?, ?, ?) ON CONFLICT(org_number, period_end) DO UPDATE SET period_start = excluded.period_start, currency = excluded.currency, source_file = excluded.source_file RETURNING id`),
    countFinancials: db.prepare("SELECT COUNT(*) as c FROM financial_data WHERE filing_id = ?"),
    deleteFinancials: db.prepare("DELETE FROM financial_data WHERE filing_id = ?"),
    deleteRoles: db.prepare("DELETE FROM company_roles WHERE filing_id = ?"),
    deleteTexts: db.prepare("DELETE FROM filing_texts WHERE filing_id = ?"),
    insertFinancial: db.prepare("INSERT INTO financial_data (filing_id, metric, value, unit) VALUES (?, ?, ?, ?)"),
    upsertPerson: db.prepare(`INSERT INTO people (first_name, last_name) VALUES (?, ?) ON CONFLICT(first_name, last_name) DO UPDATE SET first_name = excluded.first_name RETURNING id`),
    insertRole: db.prepare(`INSERT OR IGNORE INTO company_roles (filing_id, person_id, role) VALUES (?, ?, ?)`),
    insertText: db.prepare(`INSERT OR REPLACE INTO filing_texts (filing_id, field, content) VALUES (?, ?, ?)`),
  };

  // Process in transaction
  const transaction = db.transaction(() => {
    for (const innerZipName of innerZips) {
      const innerZipPath = path.join(extractDir, innerZipName);
      try {
        const innerZip = new AdmZip(innerZipPath);
        const allXhtml = innerZip.getEntries().filter(e => e.entryName.endsWith(".xhtml"));
        if (allXhtml.length === 0) continue;

        // Try all xhtml files, pick the one with the most data
        let filing: ParsedFiling | null = null;
        for (const entry of allXhtml) {
          const html = entry.getData().toString("utf-8");
          const parsed = parseIxbrl(html);
          if (parsed) {
            const totalMetrics = parsed.periods.reduce((s, p) => s + p.financials.length, 0);
            const prevTotal = filing ? filing.periods.reduce((s, p) => s + p.financials.length, 0) : 0;
            if (totalMetrics > prevTotal) filing = parsed;
          }
        }
        if (!filing) { errors++; continue; }

        stmts.upsertCompany.run(filing.orgNumber, filing.companyName);

        // Insert ALL periods from this filing (current + comparative years).
        // Only overwrite existing data if the new data has more metrics
        // (prevents a later filing's flerårsöversikt summary from replacing
        // an earlier filing's complete income statement/balance sheet).
        for (const period of filing.periods) {
          const { id: filingId } = stmts.upsertFiling.get(
            filing.orgNumber, period.periodStart, period.periodEnd, filing.currency, fileKey
          ) as { id: number };

          const existingCount = (stmts.countFinancials.get(filingId) as { c: number }).c;
          if (period.financials.length >= existingCount) {
            stmts.deleteFinancials.run(filingId);
            for (const f of period.financials) {
              stmts.insertFinancial.run(filingId, f.metric, f.value, f.unit);
            }
          }
        }

        // People and texts go on the latest period's filing
        const latestPeriod = filing.periods[filing.periods.length - 1];
        const latestFiling = stmts.upsertFiling.get(
          filing.orgNumber, latestPeriod.periodStart, latestPeriod.periodEnd, filing.currency, fileKey
        ) as { id: number };

        stmts.deleteRoles.run(latestFiling.id);
        stmts.deleteTexts.run(latestFiling.id);

        for (const p of filing.people) {
          const { id: personId } = stmts.upsertPerson.get(p.firstName, p.lastName) as { id: number };
          stmts.insertRole.run(latestFiling.id, personId, p.role);
        }
        for (const t of filing.texts) {
          stmts.insertText.run(latestFiling.id, t.field, t.content);
        }

        companiesProcessed++;
      } catch (err) {
        errors++;
        console.error(`  parse error in ${innerZipName}:`, (err as Error).message);
      } finally {
        try { unlinkSync(innerZipPath); } catch {}
      }
    }
  });

  transaction();
  if (errors > 0) console.log(`  ${errors} parse errors`);

  rmSync(extractDir, { recursive: true, force: true });
  return companiesProcessed;
}

// ── Main pipeline with parallel download/process ──────────────────────

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(TEMP_DIR, { recursive: true });

  console.log("Initializing database...");
  const db = getDb();
  initSchema(db);

  console.log("Listing available files...");
  const allFiles = await listAllFiles();
  console.log(`Found ${allFiles.length} zip files`);

  const processed = new Set(
    (db.prepare("SELECT file_key FROM processed_files").all() as { file_key: string }[])
      .map(r => r.file_key)
  );

  const remaining = allFiles.filter(f => !processed.has(f));
  console.log(`Already processed: ${processed.size}, remaining: ${remaining.length}`);

  let totalCompanies = 0;
  const startTime = Date.now();

  // Pipeline: download next file while processing current one
  let nextDownload: Promise<boolean> | null = null;
  let nextFileKey: string | null = null;
  const zipPathA = path.join(TEMP_DIR, "a.zip");
  const zipPathB = path.join(TEMP_DIR, "b.zip");

  for (let i = 0; i < remaining.length; i++) {
    const fileKey = remaining[i];
    const currentZip = i % 2 === 0 ? zipPathA : zipPathB;
    const nextZip = i % 2 === 0 ? zipPathB : zipPathA;

    // Start downloading current file if not already started
    let downloadOk: boolean;
    if (nextDownload && nextFileKey === fileKey) {
      downloadOk = await nextDownload;
    } else {
      downloadOk = await downloadFile(fileKey, currentZip);
    }

    // Start downloading next file in parallel with processing
    if (i + 1 < remaining.length) {
      nextFileKey = remaining[i + 1];
      nextDownload = downloadFile(nextFileKey, nextZip);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate = totalCompanies / Math.max(1, (Date.now() - startTime) / 1000);

    if (!downloadOk) {
      console.log(`[${i + 1}/${remaining.length}] ${fileKey} — SKIP: download failed`);
      continue;
    }

    const fileSize = existsSync(currentZip)
      ? (statSync(currentZip).size / 1024 / 1024).toFixed(0)
      : "?";

    process.stdout.write(
      `[${i + 1}/${remaining.length}] ${fileKey} (${fileSize}MB) ... `
    );

    const count = processOuterZip(db, currentZip, fileKey);
    totalCompanies += count;

    console.log(
      `${count} companies (total: ${totalCompanies}, ${elapsed}s, ${rate.toFixed(0)}/s)`
    );

    db.prepare(
      "INSERT OR REPLACE INTO processed_files (file_key, company_count) VALUES (?, ?)"
    ).run(fileKey, count);

    try { unlinkSync(currentZip); } catch {}
  }

  // Final stats
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);
  const count = (sql: string): number =>
    (db.prepare(sql).get() as { c: number }).c;
  const companyCount = count("SELECT COUNT(*) as c FROM companies");
  const filingCount = count("SELECT COUNT(*) as c FROM filings");
  const dataCount = count("SELECT COUNT(*) as c FROM financial_data");
  const peopleCount = count("SELECT COUNT(*) as c FROM people");

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Ingestion complete in ${totalTime}s`);
  console.log(`  Companies: ${companyCount.toLocaleString()}`);
  console.log(`  Filings: ${filingCount.toLocaleString()}`);
  console.log(`  Financial data points: ${dataCount.toLocaleString()}`);
  console.log(`  People: ${peopleCount.toLocaleString()}`);

  const dbPath = path.join(DATA_DIR, "bokprism.db");
  if (existsSync(dbPath)) {
    const sizeMB = (statSync(dbPath).size / 1024 / 1024).toFixed(1);
    console.log(`  DB size: ${sizeMB} MB`);
  }

  rmSync(TEMP_DIR, { recursive: true, force: true });
  db.close();
}

main().catch(console.error);
