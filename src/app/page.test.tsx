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
  ).run("556000-0001", "2024-01-01", "2024-12-31");
  const filingId = Number(filing.lastInsertRowid);
  for (const m of ["RorelseintakterLagerforandringarMm", "ResultatEfterFinansiellaPoster", "MedelantaletAnstallda"]) {
    db.prepare("INSERT INTO financial_data (filing_id, metric, value, unit) VALUES (?, ?, ?, ?)")
      .run(filingId, m, 1_000_000, "SEK");
  }
});

afterAll(() => _setDbForTests(null));

describe("HomePage", () => {
  it("renders hero, stats, and rankings preview", async () => {
    const HomePage = (await import("./page")).default;
    const element = HomePage();
    const { container } = render(element);
    expect(container.textContent).toContain("Svensk Finansdata");
    expect(container.textContent).toContain("Akme AB");
    expect(container.textContent?.toLowerCase()).toContain("omsättning");
  });
});
