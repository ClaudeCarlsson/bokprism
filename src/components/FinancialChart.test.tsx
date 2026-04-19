import { describe, it, expect, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import { FinancialChart, RevenueChart, BalanceChart, ProfitabilityChart } from "./FinancialChart";
import type { FinancialHistory } from "@/lib/types";

// Recharts measures the container before rendering. jsdom returns 0 — stub it.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 300 });
});

const sample: FinancialHistory[] = [
  {
    period_end: "2022-12-31",
    metrics: { RorelseintakterLagerforandringarMm: 5_000_000, ResultatEfterFinansiellaPoster: 500_000 },
  },
  {
    period_end: "2023-12-31",
    metrics: { RorelseintakterLagerforandringarMm: 6_000_000, ResultatEfterFinansiellaPoster: -100_000 },
  },
];

describe("FinancialChart", () => {
  it("renders with the title", () => {
    const { container } = render(
      <FinancialChart
        history={sample}
        title="Test Chart"
        metrics={[{ key: "RorelseintakterLagerforandringarMm", label: "Omsättning", color: "#000", type: "bar" }]}
      />
    );
    expect(container.textContent).toContain("Test Chart");
  });

  it("returns null for empty history", () => {
    const { container } = render(
      <FinancialChart
        history={[]}
        title="Empty"
        metrics={[{ key: "X", label: "X", color: "#000", type: "bar" }]}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("preserves missing metrics as null (no crash with sparse data)", () => {
    const partial: FinancialHistory[] = [
      { period_end: "2022-12-31", metrics: { X: 100 } },
      { period_end: "2023-12-31", metrics: {} },
    ];
    expect(() =>
      render(
        <FinancialChart
          history={partial}
          metrics={[{ key: "X", label: "X", color: "#000", type: "bar" }]}
        />
      )
    ).not.toThrow();
  });
});

describe("RevenueChart / BalanceChart / ProfitabilityChart", () => {
  it("each renders without crashing on valid data", () => {
    expect(() => render(<RevenueChart history={sample} />)).not.toThrow();
    expect(() => render(<BalanceChart history={sample} />)).not.toThrow();
    expect(() => render(<ProfitabilityChart history={sample} />)).not.toThrow();
  });
});
