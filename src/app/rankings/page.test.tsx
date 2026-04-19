import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { render } from "@testing-library/react";
import Database from "better-sqlite3";
import { initSchema } from "@/lib/db";
import { _setDbForTests } from "@/lib/queries";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    <a href={href}>{children}</a>,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeAll(() => {
  const db = new Database(":memory:");
  initSchema(db);
  _setDbForTests(db);
  db.prepare("INSERT INTO companies (org_number, name) VALUES (?, ?)").run("556000-0001", "Akme AB");
  const filing = db.prepare(
    "INSERT INTO filings (org_number, period_start, period_end) VALUES (?, ?, ?)"
  ).run("556000-0001", "2023-01-01", "2023-12-31");
  const filingId = Number(filing.lastInsertRowid);
  const rows: Array<[string, number, string]> = [
    ["RorelseintakterLagerforandringarMm", 9_000_000, "SEK"],
    ["Soliditet", 0.42, "percent"],
    ["Tillgangar", 15_000_000, "SEK"],
    ["EgetKapital", 6_000_000, "SEK"],
  ];
  for (const [m, v, u] of rows) {
    db.prepare("INSERT INTO financial_data (filing_id, metric, value, unit) VALUES (?, ?, ?, ?)")
      .run(filingId, m, v, u);
  }
});

afterAll(() => _setDbForTests(null));

describe("RankingsPage", () => {
  it("defaults to the first rankable metric when none specified", async () => {
    const RankingsPage = (await import("./page")).default;
    const element = await RankingsPage({ searchParams: Promise.resolve({}) });
    const { container } = render(element);
    expect(container.textContent).toContain("Akme AB");
  });

  it("renders the selected metric", async () => {
    const RankingsPage = (await import("./page")).default;
    const element = await RankingsPage({
      searchParams: Promise.resolve({ metric: "RorelseintakterLagerforandringarMm", order: "desc" }),
    });
    const { container } = render(element);
    expect(container.textContent).toContain("9.0 mkr");
  });

  it("formats Soliditet as a percentage", async () => {
    const RankingsPage = (await import("./page")).default;
    const element = await RankingsPage({ searchParams: Promise.resolve({ metric: "Soliditet" }) });
    const { container } = render(element);
    expect(container.textContent).toContain("42.0%");
  });

  it("falls back to default when given an invalid metric", async () => {
    const RankingsPage = (await import("./page")).default;
    const element = await RankingsPage({
      searchParams: Promise.resolve({ metric: "nonsense", order: "asc" }),
    });
    expect(() => render(element)).not.toThrow();
  });
});
