import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import Database from "better-sqlite3";
import { initSchema } from "@/lib/db";
import { _setDbForTests } from "@/lib/queries";
import { GET } from "./route";

let db: Database.Database;

beforeAll(() => {
  db = new Database(":memory:");
  initSchema(db);
  _setDbForTests(db);
  db.prepare("INSERT INTO companies (org_number, name) VALUES (?, ?)").run("556000-0001", "Akme AB");
  db.prepare("INSERT INTO filings (org_number, period_start, period_end) VALUES (?, ?, ?)")
    .run("556000-0001", "2023-01-01", "2023-12-31");
});

afterAll(() => {
  _setDbForTests(null);
  db.close();
});

async function call(url: string): Promise<{ status: number; body: unknown }> {
  const res = await GET(new NextRequest(url));
  return { status: res.status, body: await res.json() };
}

describe("GET /api/search", () => {
  it("returns an empty array for missing query", async () => {
    expect(await call("http://t/api/search")).toEqual({ status: 200, body: [] });
  });

  it("returns an empty array for queries shorter than 2 chars", async () => {
    expect(await call("http://t/api/search?q=a")).toEqual({ status: 200, body: [] });
  });

  it("finds companies by name", async () => {
    const { status, body } = await call("http://t/api/search?q=Akme");
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect((body as Array<{ org_number: string }>)[0].org_number).toBe("556000-0001");
  });

  it("clamps limit to 100", async () => {
    const { status } = await call("http://t/api/search?q=Akme&limit=9999");
    expect(status).toBe(200);
  });

  it("trims whitespace from the query", async () => {
    const { body } = await call("http://t/api/search?q=%20Akme%20");
    expect((body as unknown[]).length).toBeGreaterThan(0);
  });
});
