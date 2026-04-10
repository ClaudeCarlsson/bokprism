import { describe, it, expect } from "vitest";
import { METRIC_TAXONOMY, KEY_METRICS, RANKABLE_METRICS } from "./types";

describe("METRIC_TAXONOMY", () => {
  it("contains all key metrics", () => {
    for (const metric of KEY_METRICS) {
      expect(METRIC_TAXONOMY[metric]).toBeDefined();
      expect(METRIC_TAXONOMY[metric].sv).toBeTruthy();
      expect(METRIC_TAXONOMY[metric].en).toBeTruthy();
      expect(METRIC_TAXONOMY[metric].category).toBeTruthy();
    }
  });

  it("contains all rankable metrics", () => {
    for (const metric of RANKABLE_METRICS) {
      expect(METRIC_TAXONOMY[metric.key]).toBeDefined();
    }
  });

  it("has valid categories for all entries", () => {
    const validCategories = new Set([
      "income",
      "balance_asset",
      "balance_equity",
      "balance_liability",
      "ratio",
      "other",
    ]);
    for (const [key, meta] of Object.entries(METRIC_TAXONOMY)) {
      expect(validCategories.has(meta.category), `Invalid category for ${key}: ${meta.category}`).toBe(true);
    }
  });

  it("income statement has subtotals marked", () => {
    expect(METRIC_TAXONOMY.Rorelseresultat.isSubtotal).toBe(true);
    expect(METRIC_TAXONOMY.AretsResultat.isSubtotal).toBe(true);
    expect(METRIC_TAXONOMY.Tillgangar.isSubtotal).toBe(true);
    expect(METRIC_TAXONOMY.EgetKapital.isSubtotal).toBe(true);
  });

  it("has Swedish and English labels for all entries", () => {
    for (const [key, meta] of Object.entries(METRIC_TAXONOMY)) {
      expect(meta.sv.length, `Missing sv label for ${key}`).toBeGreaterThan(0);
      expect(meta.en.length, `Missing en label for ${key}`).toBeGreaterThan(0);
    }
  });
});

describe("KEY_METRICS", () => {
  it("contains revenue and profit", () => {
    expect(KEY_METRICS).toContain("Nettoomsattning");
    expect(KEY_METRICS).toContain("AretsResultat");
  });

  it("has 8 key metrics", () => {
    expect(KEY_METRICS).toHaveLength(8);
  });
});

describe("RANKABLE_METRICS", () => {
  it("has labels for all entries", () => {
    for (const m of RANKABLE_METRICS) {
      expect(m.key).toBeTruthy();
      expect(m.label).toBeTruthy();
    }
  });
});
