import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { render } from "@testing-library/react";
import Database from "better-sqlite3";
import { initSchema } from "@/lib/db";
import { _setDbForTests } from "@/lib/queries";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    <a href={href}>{children}</a>,
}));
const notFoundMock = vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); });
vi.mock("next/navigation", () => ({ notFound: () => notFoundMock() }));

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 300 });

  const db = new Database(":memory:");
  initSchema(db);
  _setDbForTests(db);
  db.prepare("INSERT INTO companies (org_number, name) VALUES (?, ?)").run("556000-0001", "Akme AB");
  const r1 = db.prepare("INSERT INTO filings (org_number, period_start, period_end) VALUES (?, ?, ?)")
    .run("556000-0001", "2022-01-01", "2022-12-31");
  const r2 = db.prepare("INSERT INTO filings (org_number, period_start, period_end) VALUES (?, ?, ?)")
    .run("556000-0001", "2023-01-01", "2023-12-31");
  const f1 = Number(r1.lastInsertRowid);
  const f2 = Number(r2.lastInsertRowid);
  const seed = (filingId: number, metric: string, value: number) =>
    db.prepare("INSERT INTO financial_data (filing_id, metric, value, unit) VALUES (?, ?, ?, ?)")
      .run(filingId, metric, value, "SEK");
  for (const [fid, rev, eq, ta] of [[f1, 4_500_000, 2_000_000, 8_000_000], [f2, 5_000_000, 2_200_000, 9_000_000]] as const) {
    seed(fid, "RorelseintakterLagerforandringarMm", rev);
    seed(fid, "Tillgangar", ta);
    seed(fid, "EgetKapital", eq);
  }
  db.prepare("INSERT INTO filing_texts (filing_id, field, content) VALUES (?, ?, ?)")
    .run(f2, "verksamhet", "Vi gör saker.");
  db.prepare("INSERT INTO filing_texts (filing_id, field, content) VALUES (?, ?, ?)")
    .run(f2, "vasentliga_handelser", "En märklig händelse 2023.");
});

afterAll(() => _setDbForTests(null));

describe("CompanyPage", () => {
  it("renders the company header and key metrics", async () => {
    const CompanyPage = (await import("./page")).default;
    const element = await CompanyPage({ params: Promise.resolve({ orgNumber: "556000-0001" }) });
    const { container } = render(element);
    expect(container.textContent).toContain("Akme AB");
    expect(container.textContent).toContain("556000-0001");
  });

  it("calls notFound() for unknown org number", async () => {
    const CompanyPage = (await import("./page")).default;
    await expect(
      CompanyPage({ params: Promise.resolve({ orgNumber: "999999-9999" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("generateMetadata returns a title with the company name", async () => {
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata({ params: Promise.resolve({ orgNumber: "556000-0001" }) });
    expect(meta.title).toContain("Akme AB");
  });

  it("generateMetadata falls back for unknown org", async () => {
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata({ params: Promise.resolve({ orgNumber: "000000-0000" }) });
    expect(meta.title).toBeDefined();
  });

  it("exposes the vasentliga_handelser tab when the text is present", async () => {
    const CompanyPage = (await import("./page")).default;
    const element = await CompanyPage({ params: Promise.resolve({ orgNumber: "556000-0001" }) });
    const { container } = render(element);
    expect(container.textContent).toContain("Handelser");
  });

  it("shows a notice when a company has no complete filings", async () => {
    // Insert a company whose only filing lacks a balance sheet.
    const Database = (await import("better-sqlite3")).default;
    const { initSchema } = await import("@/lib/db");
    const { _setDbForTests } = await import("@/lib/queries");
    const fresh = new Database(":memory:");
    initSchema(fresh);
    _setDbForTests(fresh);
    fresh.prepare("INSERT INTO companies (org_number, name) VALUES (?, ?)").run("556999-9999", "Tomt AB");
    const r = fresh.prepare("INSERT INTO filings (org_number, period_start, period_end) VALUES (?, ?, ?)")
      .run("556999-9999", "2023-01-01", "2023-12-31");
    fresh.prepare("INSERT INTO financial_data (filing_id, metric, value, unit) VALUES (?, ?, ?, ?)")
      .run(Number(r.lastInsertRowid), "Nettoomsattning", 1000, "SEK");

    const CompanyPage = (await import("./page")).default;
    const element = await CompanyPage({ params: Promise.resolve({ orgNumber: "556999-9999" }) });
    const { container } = render(element);
    expect(container.textContent).toContain("Ingen fullständig årsredovisning");
  });
});
