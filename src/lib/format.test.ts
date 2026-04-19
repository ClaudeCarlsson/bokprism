import { describe, it, expect } from "vitest";
import {
  formatSEK,
  formatPercent,
  formatCount,
  formatMetricValue,
  formatOrgNumber,
  formatPeriod,
  trendDirection,
  trendPercent,
} from "./format";

describe("formatSEK", () => {
  it("formats billions", () => {
    expect(formatSEK(131_500_000_000)).toBe("131.5 mdr");
    expect(formatSEK(1_000_000_000)).toBe("1.0 mdr");
  });

  it("formats millions", () => {
    expect(formatSEK(101_763_063)).toBe("101.8 mkr");
    expect(formatSEK(1_500_000)).toBe("1.5 mkr");
  });

  it("formats thousands", () => {
    expect(formatSEK(140_000)).toBe("140 tkr");
    expect(formatSEK(1_000)).toBe("1 tkr");
  });

  it("formats small amounts", () => {
    expect(formatSEK(500)).toBe("500 kr");
    expect(formatSEK(0)).toBe("0 kr");
  });

  it("formats negative values", () => {
    expect(formatSEK(-5_000_000)).toBe("-5.0 mkr");
    expect(formatSEK(-175_229)).toBe("-175 tkr");
  });

  it("handles null and undefined", () => {
    expect(formatSEK(null)).toBe("–");
    expect(formatSEK(undefined)).toBe("–");
  });
});

describe("formatPercent", () => {
  it("formats decimal as percentage", () => {
    expect(formatPercent(1.0)).toBe("100.0%");
    expect(formatPercent(0.42)).toBe("42.0%");
    expect(formatPercent(0.335)).toBe("33.5%");
  });

  it("formats negative percentages", () => {
    expect(formatPercent(-0.15)).toBe("-15.0%");
  });

  it("handles null and undefined", () => {
    expect(formatPercent(null)).toBe("–");
    expect(formatPercent(undefined)).toBe("–");
  });
});

describe("formatCount", () => {
  it("formats integer counts", () => {
    expect(formatCount(42)).toMatch(/42/);
    expect(formatCount(0)).toMatch(/0/);
    expect(formatCount(1234)).toMatch(/1.*234/);
  });

  it("handles null and undefined", () => {
    expect(formatCount(null)).toBe("–");
    expect(formatCount(undefined)).toBe("–");
  });
});

describe("formatMetricValue", () => {
  it("uses SEK formatting for income/balance metrics", () => {
    expect(formatMetricValue(1_500_000, "Nettoomsattning")).toBe("1.5 mkr");
  });

  it("uses percent formatting for Soliditet", () => {
    expect(formatMetricValue(0.42, "Soliditet")).toBe("42.0%");
  });

  it("uses count formatting for employee count", () => {
    expect(formatMetricValue(150, "MedelantaletAnstallda")).toMatch(/150/);
  });

  it("falls back to SEK when the metric is unknown", () => {
    expect(formatMetricValue(1_000, "UnknownMetric")).toBe("1 tkr");
  });

  it("returns a dash for null / undefined", () => {
    expect(formatMetricValue(null, "Nettoomsattning")).toBe("–");
    expect(formatMetricValue(undefined, "Nettoomsattning")).toBe("–");
  });
});

describe("formatOrgNumber", () => {
  it("formats 10-digit number with dash", () => {
    expect(formatOrgNumber("5560701715")).toBe("556070-1715");
  });

  it("preserves already formatted number", () => {
    expect(formatOrgNumber("556070-1715")).toBe("556070-1715");
  });

  it("returns input for non-standard formats", () => {
    expect(formatOrgNumber("12345")).toBe("12345");
  });
});

describe("formatPeriod", () => {
  it("formats calendar year", () => {
    expect(formatPeriod("2024-12-31")).toBe("2024");
    expect(formatPeriod("2023-12-31")).toBe("2023");
  });

  it("formats broken fiscal year", () => {
    expect(formatPeriod("2024-06-30")).toBe("2023/24");
    expect(formatPeriod("2024-08-31")).toBe("2023/24");
  });

  it("returns dash for empty or too-short input", () => {
    expect(formatPeriod("")).toBe("–");
    expect(formatPeriod(null)).toBe("–");
    expect(formatPeriod(undefined)).toBe("–");
    expect(formatPeriod("2024")).toBe("–");
  });

  it("returns dash for malformed date", () => {
    expect(formatPeriod("not-a-date")).toBe("–");
  });
});

describe("trendDirection", () => {
  it("returns up for increase", () => {
    expect(trendDirection(110, 100)).toBe("up");
  });

  it("returns down for decrease", () => {
    expect(trendDirection(90, 100)).toBe("down");
  });

  it("returns flat for small change", () => {
    expect(trendDirection(100.5, 100)).toBe("flat");
  });

  it("returns null when values are missing", () => {
    expect(trendDirection(null, 100)).toBeNull();
    expect(trendDirection(100, null)).toBeNull();
    expect(trendDirection(null, null)).toBeNull();
  });

  it("handles zero previous value", () => {
    expect(trendDirection(100, 0)).toBe("up");
    expect(trendDirection(-100, 0)).toBe("down");
    expect(trendDirection(0, 0)).toBe("flat");
  });
});

describe("trendPercent", () => {
  it("calculates positive change", () => {
    expect(trendPercent(110, 100)).toBeCloseTo(0.1);
  });

  it("calculates negative change", () => {
    expect(trendPercent(90, 100)).toBeCloseTo(-0.1);
  });

  it("returns null for missing values", () => {
    expect(trendPercent(null, 100)).toBeNull();
    expect(trendPercent(100, null)).toBeNull();
  });

  it("returns null for zero previous", () => {
    expect(trendPercent(100, 0)).toBeNull();
  });

  it("handles negative previous value correctly", () => {
    expect(trendPercent(-50, -100)).toBeCloseTo(0.5);
  });
});
