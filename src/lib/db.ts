import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "bokprism.db");

export function getDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("cache_size = -64000"); // 64MB cache
  db.pragma("temp_store = MEMORY");
  db.pragma("mmap_size = 268435456"); // 256MB mmap
  return db;
}

export function initSchema(db: Database.Database): void {
  db.exec(`
    -- Core company identity
    CREATE TABLE IF NOT EXISTS companies (
      org_number TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    -- One row per annual report filing
    CREATE TABLE IF NOT EXISTS filings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_number TEXT NOT NULL REFERENCES companies(org_number),
      period_start TEXT NOT NULL,    -- fiscal year start YYYY-MM-DD
      period_end TEXT NOT NULL,      -- fiscal year end YYYY-MM-DD
      currency TEXT DEFAULT 'SEK',
      source_file TEXT,
      UNIQUE(org_number, period_end)
    );

    -- All financial numbers: EAV with the XBRL tag as metric
    -- Stores ONLY the primary period (current year) data from each filing
    -- All monetary values stored in SEK (not thousands)
    CREATE TABLE IF NOT EXISTS financial_data (
      filing_id INTEGER NOT NULL REFERENCES filings(id),
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL DEFAULT 'SEK',  -- SEK, percent, count
      PRIMARY KEY (filing_id, metric)
    );

    -- Board members, signatories, auditors
    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      UNIQUE(first_name, last_name)
    );

    -- People linked to filings with their role
    CREATE TABLE IF NOT EXISTS company_roles (
      filing_id INTEGER NOT NULL REFERENCES filings(id),
      person_id INTEGER NOT NULL REFERENCES people(id),
      role TEXT NOT NULL,
      PRIMARY KEY (filing_id, person_id, role)
    );

    -- Business descriptions and significant events
    CREATE TABLE IF NOT EXISTS filing_texts (
      filing_id INTEGER NOT NULL REFERENCES filings(id),
      field TEXT NOT NULL,       -- verksamhet, vasentliga_handelser, redovisningsprinciper
      content TEXT NOT NULL,
      PRIMARY KEY (filing_id, field)
    );

    -- Track processed zip files for resumability
    CREATE TABLE IF NOT EXISTS processed_files (
      file_key TEXT PRIMARY KEY,
      processed_at TEXT NOT NULL DEFAULT (datetime('now')),
      company_count INTEGER DEFAULT 0
    );

    -- === INDEXES FOR SNAPPY QUERIES ===

    -- Find filings by company (time series)
    CREATE INDEX IF NOT EXISTS idx_filings_org
      ON filings(org_number, period_end);

    -- Search companies by name (prefix search)
    CREATE INDEX IF NOT EXISTS idx_companies_name
      ON companies(name COLLATE NOCASE);

    -- Find companies by metric value (e.g. "all companies with revenue > 100M")
    CREATE INDEX IF NOT EXISTS idx_fd_metric_value
      ON financial_data(metric, value);

    -- Get all metrics for a filing quickly
    CREATE INDEX IF NOT EXISTS idx_fd_filing
      ON financial_data(filing_id);

    -- Find all companies a person is connected to
    CREATE INDEX IF NOT EXISTS idx_roles_person
      ON company_roles(person_id);

    -- Find all people for a filing
    CREATE INDEX IF NOT EXISTS idx_roles_filing
      ON company_roles(filing_id);

    -- Full-text search on company names
    CREATE VIRTUAL TABLE IF NOT EXISTS companies_fts USING fts5(
      name,
      org_number,
      content='companies',
      content_rowid='rowid'
    );

    -- Triggers to keep FTS in sync
    CREATE TRIGGER IF NOT EXISTS companies_ai AFTER INSERT ON companies BEGIN
      INSERT INTO companies_fts(rowid, name, org_number)
      VALUES (new.rowid, new.name, new.org_number);
    END;
    CREATE TRIGGER IF NOT EXISTS companies_au AFTER UPDATE ON companies BEGIN
      INSERT INTO companies_fts(companies_fts, rowid, name, org_number)
      VALUES ('delete', old.rowid, old.name, old.org_number);
      INSERT INTO companies_fts(rowid, name, org_number)
      VALUES (new.rowid, new.name, new.org_number);
    END;
  `);
}
