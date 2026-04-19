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

let personId: number;

beforeAll(() => {
  const db = new Database(":memory:");
  initSchema(db);
  _setDbForTests(db);
  db.prepare("INSERT INTO companies (org_number, name) VALUES (?, ?)").run("556000-0001", "Akme AB");
  const filing = db.prepare(
    "INSERT INTO filings (org_number, period_start, period_end) VALUES (?, ?, ?)"
  ).run("556000-0001", "2023-01-01", "2023-12-31");
  const filingId = Number(filing.lastInsertRowid);
  const person = db.prepare("INSERT INTO people (first_name, last_name) VALUES (?, ?)").run("Anna", "Svensson");
  personId = Number(person.lastInsertRowid);
  db.prepare("INSERT INTO company_roles (filing_id, person_id, role) VALUES (?, ?, ?)")
    .run(filingId, personId, "Styrelseledamot");
});

afterAll(() => _setDbForTests(null));

describe("PersonPage", () => {
  it("renders the person name and company connections", async () => {
    const PersonPage = (await import("./page")).default;
    const element = await PersonPage({ params: Promise.resolve({ id: String(personId) }) });
    const { container } = render(element);
    expect(container.textContent).toContain("Anna Svensson");
    expect(container.textContent).toContain("Akme AB");
    expect(container.textContent).toContain("Styrelseledamot");
  });

  it("throws notFound for invalid id", async () => {
    const PersonPage = (await import("./page")).default;
    await expect(
      PersonPage({ params: Promise.resolve({ id: "not-a-number" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("throws notFound for unknown id", async () => {
    const PersonPage = (await import("./page")).default;
    await expect(
      PersonPage({ params: Promise.resolve({ id: "999999" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("generateMetadata returns person name", async () => {
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata({ params: Promise.resolve({ id: String(personId) }) });
    expect(meta.title).toContain("Anna");
  });

  it("generateMetadata falls back for non-numeric id", async () => {
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata({ params: Promise.resolve({ id: "abc" }) });
    expect(meta.title).toBeDefined();
  });

  it("generateMetadata falls back for unknown id", async () => {
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata({ params: Promise.resolve({ id: "9999" }) });
    expect(meta.title).toBeDefined();
  });
});
