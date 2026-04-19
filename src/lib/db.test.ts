import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initSchema, getDb } from "./db";

describe("initSchema", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    initSchema(db);
  });

  afterEach(() => db.close());

  it("creates all expected tables", () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];
    const names = tables.map(t => t.name);
    expect(names).toContain("companies");
    expect(names).toContain("filings");
    expect(names).toContain("financial_data");
    expect(names).toContain("people");
    expect(names).toContain("company_roles");
    expect(names).toContain("filing_texts");
    expect(names).toContain("processed_files");
    expect(names).toContain("companies_fts");
  });

  it("is idempotent (CREATE TABLE IF NOT EXISTS)", () => {
    expect(() => initSchema(db)).not.toThrow();
  });

  it("creates indexes for query paths", () => {
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index'"
    ).all() as { name: string }[];
    const names = indexes.map(i => i.name);
    expect(names).toContain("idx_filings_org");
    expect(names).toContain("idx_fd_metric_value");
    expect(names).toContain("idx_roles_person");
  });

  it("enforces UNIQUE(org_number, period_end) on filings", () => {
    db.prepare("INSERT INTO companies (org_number, name) VALUES (?, ?)").run("556000-0001", "X");
    db.prepare("INSERT INTO filings (org_number, period_start, period_end) VALUES (?, ?, ?)")
      .run("556000-0001", "2023-01-01", "2023-12-31");
    expect(() =>
      db.prepare("INSERT INTO filings (org_number, period_start, period_end) VALUES (?, ?, ?)")
        .run("556000-0001", "2023-01-01", "2023-12-31")
    ).toThrow();
  });

  it("wires up FTS5 triggers so companies sync to companies_fts", () => {
    db.prepare("INSERT INTO companies (org_number, name) VALUES (?, ?)").run("556000-0001", "Sökbart AB");
    const hit = db.prepare(
      "SELECT org_number FROM companies_fts WHERE companies_fts MATCH ?"
    ).get('"sökbart"*') as { org_number: string } | undefined;
    expect(hit?.org_number).toBe("556000-0001");
  });
});

describe("getDb", () => {
  it("opens a SQLite database at data/bokprism.db in the cwd", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bokprism-db-"));
    fs.mkdirSync(path.join(tmp, "data"));
    fs.writeFileSync(path.join(tmp, "data", "bokprism.db"), "");
    const origCwd = process.cwd();
    try {
      process.chdir(tmp);
      const db = getDb();
      expect(db.open).toBe(true);
      // WAL journal mode is one of the pragmas we set.
      const mode = db.pragma("journal_mode", { simple: true });
      expect(String(mode).toLowerCase()).toBe("wal");
      db.close();
    } finally {
      process.chdir(origCwd);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
