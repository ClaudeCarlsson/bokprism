import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { initSchema } from "./db";
import {
  searchCompanies,
  getCompanyDetail,
  getFinancialHistory,
  getCompanyPeople,
  getPersonWithCompanies,
  getRankings,
  getSiteStats,
  _setDbForTests,
} from "./queries";

let db: Database.Database;

function insertFiling(
  orgNumber: string,
  periodStart: string,
  periodEnd: string,
  metrics: Record<string, number> = {},
  texts: Record<string, string> = {},
): number {
  const result = db.prepare(
    "INSERT INTO filings (org_number, period_start, period_end, source_file) VALUES (?, ?, ?, ?)"
  ).run(orgNumber, periodStart, periodEnd, "test.zip");
  const filingId = Number(result.lastInsertRowid);
  for (const [metric, value] of Object.entries(metrics)) {
    db.prepare(
      "INSERT INTO financial_data (filing_id, metric, value, unit) VALUES (?, ?, ?, ?)"
    ).run(filingId, metric, value, "SEK");
  }
  for (const [field, content] of Object.entries(texts)) {
    db.prepare(
      "INSERT INTO filing_texts (filing_id, field, content) VALUES (?, ?, ?)"
    ).run(filingId, field, content);
  }
  return filingId;
}

function insertPerson(firstName: string, lastName: string): number {
  const r = db.prepare("INSERT INTO people (first_name, last_name) VALUES (?, ?)")
    .run(firstName, lastName);
  return Number(r.lastInsertRowid);
}

function linkRole(filingId: number, personId: number, role: string): void {
  db.prepare("INSERT INTO company_roles (filing_id, person_id, role) VALUES (?, ?, ?)")
    .run(filingId, personId, role);
}

beforeAll(() => {
  db = new Database(":memory:");
  initSchema(db);
  _setDbForTests(db);

  // Valid-era companies
  db.prepare("INSERT INTO companies (org_number, name) VALUES (?, ?)").run("556000-0001", "Akme AB");
  db.prepare("INSERT INTO companies (org_number, name) VALUES (?, ?)").run("556000-0002", "K2 Bolaget AB");
  db.prepare("INSERT INTO companies (org_number, name) VALUES (?, ?)").run("556000-0003", "Nollbolaget AB");
  db.prepare("INSERT INTO companies (org_number, name) VALUES (?, ?)").run("556000-0004", "Tyst AB");
  db.prepare("INSERT INTO companies (org_number, name) VALUES (?, ?)").run("556000-0005", "Delvis AB");

  // Akme: full K3 history, two filings including a bogus-date artifact
  insertFiling("556000-0001", "1899-01-02", "1899-12-30", { Nettoomsattning: 12345 }); // bogus
  insertFiling("556000-0001", "2022-01-01", "2022-12-31", {
    RorelseintakterLagerforandringarMm: 5_000_000,
    Nettoomsattning: 5_000_000,
    ResultatEfterFinansiellaPoster: 500_000,
    Tillgangar: 10_000_000,
    EgetKapital: 4_000_000,
  }, { verksamhet: "Vi gör saker." });
  insertFiling("556000-0001", "2023-01-01", "2023-12-31", {
    RorelseintakterLagerforandringarMm: 6_000_000,
    Nettoomsattning: 6_000_000,
    ResultatEfterFinansiellaPoster: 700_000,
    Tillgangar: 12_000_000,
    EgetKapital: 4_500_000,
  });

  // K2 Bolaget: Nettoomsattning only (headline subtotal missing) + balance sheet
  insertFiling("556000-0002", "2021-01-01", "2021-12-31", {
    Nettoomsattning: 1_800_000,
    ResultatEfterFinansiellaPoster: 200_000,
    Tillgangar: 3_000_000,
    EgetKapital: 1_500_000,
  });
  insertFiling("556000-0002", "2022-01-01", "2022-12-31", {
    Nettoomsattning: 2_000_000,
    ResultatEfterFinansiellaPoster: 250_000,
    Tillgangar: 3_500_000,
    EgetKapital: 1_700_000,
  });

  // Nollbolaget: dormant but complete (zero values across the board)
  insertFiling("556000-0003", "2023-01-01", "2023-12-31", {
    RorelseintakterLagerforandringarMm: 0,
    Nettoomsattning: 0,
    ResultatEfterFinansiellaPoster: -5000,
    Tillgangar: 100_000,
    EgetKapital: 50_000,
  });

  // Tyst AB: only one bogus-date filing (nothing valid) — should be invisible
  insertFiling("556000-0004", "0000-01-02", "0001-01-01", { Nettoomsattning: 999 });

  // Delvis AB: mix of complete and incomplete filings — tests that the
  // completeness filter drops partial years while keeping full-K3 years.
  insertFiling("556000-0005", "2020-01-01", "2020-12-31", {
    Nettoomsattning: 900_000,
    ResultatEfterFinansiellaPoster: 50_000,
    // no Tillgangar / EgetKapital — balance sheet not filed
  });
  insertFiling("556000-0005", "2021-01-01", "2021-12-31", {
    Nettoomsattning: 950_000,
    ResultatEfterFinansiellaPoster: 60_000,
    // no balance sheet
  });
  insertFiling("556000-0005", "2022-01-01", "2022-12-31", {
    RorelseintakterLagerforandringarMm: 1_000_000,
    Nettoomsattning: 1_000_000,
    ResultatEfterFinansiellaPoster: 100_000,
    Tillgangar: 2_000_000,
    EgetKapital: 1_200_000,
  });
  insertFiling("556000-0005", "2023-01-01", "2023-12-31", {
    RorelseintakterLagerforandringarMm: 1_100_000,
    Nettoomsattning: 1_100_000,
    ResultatEfterFinansiellaPoster: 120_000,
    Tillgangar: 2_100_000,
    EgetKapital: 1_300_000,
  });

  // People
  const anna = insertPerson("Anna", "Svensson");
  const bengt = insertPerson("Bengt", "Andersson");
  // Anna appears on a real filing and the bogus one
  linkRole(1, anna, "styrelseledamot"); // filing_id=1 is the bogus Akme filing
  linkRole(2, anna, "styrelseledamot"); // 2022 filing
  linkRole(3, anna, "styrelseordförande"); // 2023 filing
  linkRole(4, bengt, "styrelseledamot"); // K2 2021
});

afterAll(() => {
  _setDbForTests(null);
  db.close();
});

describe("getSiteStats", () => {
  it("excludes pre-2015 artifact dates from year range", () => {
    const stats = getSiteStats();
    expect(stats.years_covered).toBe("2020–2023");
  });

  it("counts everything else accurately", () => {
    const stats = getSiteStats();
    expect(stats.total_companies).toBe(5);
    expect(stats.total_filings).toBeGreaterThan(4); // includes bogus ones
    expect(stats.total_people).toBe(2);
  });
});

describe("searchCompanies", () => {
  it("finds by exact org number", () => {
    const results = searchCompanies("556000-0001");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Akme AB");
  });

  it("accepts org number without dash", () => {
    const results = searchCompanies("5560000001");
    expect(results).toHaveLength(1);
  });

  it("falls back to Nettoomsattning for K2 companies missing the headline subtotal", () => {
    const results = searchCompanies("556000-0002");
    expect(results[0].latest_revenue).toBe(2_000_000);
  });

  it("returns the headline metric when present", () => {
    const results = searchCompanies("556000-0001");
    expect(results[0].latest_revenue).toBe(6_000_000);
  });

  it("excludes pre-2015 artifact filings from filing_count", () => {
    const results = searchCompanies("556000-0001");
    expect(results[0].filing_count).toBe(2);
  });

  it("returns latest valid period_end only", () => {
    const results = searchCompanies("556000-0001");
    expect(results[0].latest_period).toBe("2023-12-31");
  });

  it("finds by name via FTS", () => {
    const results = searchCompanies("Akme");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].org_number).toBe("556000-0001");
  });

  it("respects limit", () => {
    const results = searchCompanies("AB", 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });
});

describe("getCompanyDetail", () => {
  it("returns null for unknown company", () => {
    expect(getCompanyDetail("999999-9999")).toBeNull();
  });

  it("excludes pre-2015 filings", () => {
    const detail = getCompanyDetail("556000-0001");
    expect(detail?.filings).toHaveLength(2);
    expect(detail?.filings.every(f => f.period_end >= "2015-01-01")).toBe(true);
  });

  it("returns latest filing financials with K2 fallback applied", () => {
    const detail = getCompanyDetail("556000-0002");
    expect(detail?.latestFinancials.RorelseintakterLagerforandringarMm).toBe(2_000_000);
  });

  it("returns texts for latest filing", () => {
    const detail = getCompanyDetail("556000-0001");
    expect(detail?.texts.verksamhet).toBeUndefined(); // 2023 filing had no text
  });

  it("returns empty filings array for companies with only bogus dates", () => {
    const detail = getCompanyDetail("556000-0004");
    expect(detail?.filings).toHaveLength(0);
    expect(detail?.latestFinancials).toEqual({});
  });
});

describe("getFinancialHistory", () => {
  it("returns history in chronological order (oldest first)", () => {
    const history = getFinancialHistory("556000-0001");
    expect(history.map(h => h.period_end)).toEqual(["2022-12-31", "2023-12-31"]);
  });

  it("applies K2 fallback to each period", () => {
    const history = getFinancialHistory("556000-0002");
    expect(history[0].metrics.RorelseintakterLagerforandringarMm).toBe(1_800_000);
    expect(history[1].metrics.RorelseintakterLagerforandringarMm).toBe(2_000_000);
  });

  it("excludes bogus pre-2015 periods", () => {
    const history = getFinancialHistory("556000-0001");
    expect(history.every(h => h.period_end >= "2015-01-01")).toBe(true);
  });

  it("leaves explicit zero values alone (doesn't treat 0 as missing)", () => {
    const history = getFinancialHistory("556000-0003");
    expect(history[0].metrics.RorelseintakterLagerforandringarMm).toBe(0);
  });
});

describe("getCompanyPeople", () => {
  it("excludes roles from pre-2015 filings", () => {
    const people = getCompanyPeople("556000-0001");
    // Anna is linked to filing_id=1 (bogus) and filings 2+3 (real) — two distinct roles
    expect(people).toHaveLength(2);
    expect(people.every(p => p.filing_period_end >= "2015-01-01")).toBe(true);
  });

  it("orders by period_end descending", () => {
    const people = getCompanyPeople("556000-0001");
    expect(people[0].filing_period_end >= people[people.length - 1].filing_period_end).toBe(true);
  });
});

describe("getPersonWithCompanies", () => {
  it("returns null for unknown person", () => {
    expect(getPersonWithCompanies(9999)).toBeNull();
  });

  it("lists company connections with most recent period_end", () => {
    const anna = getPersonWithCompanies(1);
    expect(anna?.companies.some(c => c.org_number === "556000-0001")).toBe(true);
    const akme = anna!.companies.find(c => c.org_number === "556000-0001");
    // MAX(period_end) over real filings, ignoring the bogus 1899 row
    expect(akme!.period_end >= "2015-01-01").toBe(true);
  });

  it("returns distinct role entries", () => {
    const anna = getPersonWithCompanies(1);
    // Anna has styrelseledamot + styrelseordförande on same company
    const roles = new Set(anna!.companies.map(c => c.role));
    expect(roles.size).toBeGreaterThanOrEqual(2);
  });
});

describe("getRankings", () => {
  it("orders descending by default", () => {
    const top = getRankings("RorelseintakterLagerforandringarMm", "desc", 10);
    expect(top[0].value).toBeGreaterThanOrEqual(top[top.length - 1].value);
  });

  it("orders ascending when requested", () => {
    const bottom = getRankings("ResultatEfterFinansiellaPoster", "asc", 10);
    expect(bottom[0].value).toBeLessThanOrEqual(bottom[bottom.length - 1].value);
  });

  it("excludes zero values", () => {
    const all = getRankings("RorelseintakterLagerforandringarMm", "desc", 10);
    expect(all.every(r => r.value !== 0)).toBe(true);
    expect(all.some(r => r.org_number === "556000-0003")).toBe(false);
  });

  it("respects limit", () => {
    const top1 = getRankings("Nettoomsattning", "desc", 1);
    expect(top1).toHaveLength(1);
  });

  it("applies MIN_VALID_PERIOD_END floor even without explicit minPeriod", () => {
    const results = getRankings("Nettoomsattning", "desc", 10);
    expect(results.every(r => r.period_end >= "2015-01-01")).toBe(true);
  });

  it("respects caller-provided minPeriod when stricter", () => {
    const results = getRankings("RorelseintakterLagerforandringarMm", "desc", 10, "2023-06-01");
    expect(results.every(r => r.period_end >= "2023-06-01")).toBe(true);
  });

  it("only ranks the latest filing per company", () => {
    // Akme has 2022 (5M) and 2023 (6M) — should appear once, with 2023 value
    const results = getRankings("RorelseintakterLagerforandringarMm", "desc", 10);
    const akme = results.filter(r => r.org_number === "556000-0001");
    expect(akme).toHaveLength(1);
    expect(akme[0].value).toBe(6_000_000);
  });
});

describe("period-completeness filtering", () => {
  it("drops incomplete years from getFinancialHistory", () => {
    // Delvis AB has 4 filings (2020, 2021, 2022, 2023) — 2020/2021 lack a
    // balance sheet, 2022/2023 are full K3.
    const history = getFinancialHistory("556000-0005");
    expect(history.map(h => h.period_end)).toEqual(["2022-12-31", "2023-12-31"]);
  });

  it("drops incomplete filings from getCompanyDetail.filings", () => {
    const detail = getCompanyDetail("556000-0005");
    expect(detail?.filings).toHaveLength(2);
    expect(detail?.filings.every(f => f.period_end >= "2022-01-01")).toBe(true);
  });

  it("picks the latest COMPLETE filing as the source of latestFinancials", () => {
    const detail = getCompanyDetail("556000-0005");
    expect(detail?.latestFinancials.RorelseintakterLagerforandringarMm).toBe(1_100_000);
    expect(detail?.latestFinancials.Tillgangar).toBe(2_100_000);
  });

  it("returns an empty filings list when no filing is complete", () => {
    // Tyst AB has only a pre-2015 bogus filing, already filtered. Add a
    // valid-era but incomplete filing to prove completeness filters too.
    db.prepare("INSERT INTO companies (org_number, name) VALUES (?, ?)").run("556000-0006", "Halv AB");
    const r = db.prepare("INSERT INTO filings (org_number, period_start, period_end, source_file) VALUES (?, ?, ?, ?)")
      .run("556000-0006", "2023-01-01", "2023-12-31", "t.zip");
    const id = Number(r.lastInsertRowid);
    // income line only, no balance sheet
    db.prepare("INSERT INTO financial_data (filing_id, metric, value, unit) VALUES (?, ?, ?, ?)")
      .run(id, "Nettoomsattning", 500_000, "SEK");

    const detail = getCompanyDetail("556000-0006");
    expect(detail).not.toBeNull();
    expect(detail?.filings).toHaveLength(0);
    expect(detail?.latestFinancials).toEqual({});
  });

  it("excludes incomplete filings from search latest_* subqueries", () => {
    // Delvis AB's 2020/2021 filings only have Nettoomsattning but no balance,
    // so the latest_period should pin to 2023, not 2021.
    const results = searchCompanies("556000-0005");
    expect(results[0].latest_period).toBe("2023-12-31");
    expect(results[0].filing_count).toBe(2);
  });

  it("excludes companies with no complete filing from rankings", () => {
    db.prepare("INSERT INTO companies (org_number, name) VALUES (?, ?)").run("556000-0007", "Bara Omsattning AB");
    const r = db.prepare("INSERT INTO filings (org_number, period_start, period_end, source_file) VALUES (?, ?, ?, ?)")
      .run("556000-0007", "2023-01-01", "2023-12-31", "t.zip");
    db.prepare("INSERT INTO financial_data (filing_id, metric, value, unit) VALUES (?, ?, ?, ?)")
      .run(Number(r.lastInsertRowid), "Nettoomsattning", 99_000_000, "SEK");
    // Despite a huge revenue, this company lacks a balance sheet → excluded.
    const results = getRankings("Nettoomsattning", "desc", 20);
    expect(results.some(r => r.org_number === "556000-0007")).toBe(false);
  });
});
