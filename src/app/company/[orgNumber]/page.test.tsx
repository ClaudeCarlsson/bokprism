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
  db.prepare("INSERT INTO financial_data (filing_id, metric, value, unit) VALUES (?, ?, ?, ?)")
    .run(f1, "RorelseintakterLagerforandringarMm", 4_500_000, "SEK");
  db.prepare("INSERT INTO financial_data (filing_id, metric, value, unit) VALUES (?, ?, ?, ?)")
    .run(f2, "RorelseintakterLagerforandringarMm", 5_000_000, "SEK");
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
});
