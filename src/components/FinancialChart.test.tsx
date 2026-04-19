import { describe, it, expect, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import { FinancialChart, RevenueChart, BalanceChart, ProfitabilityChart, _CustomTooltipForTest, _CustomLegendForTest } from "./FinancialChart";
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

describe("CustomTooltip", () => {
  it("returns null when not active", () => {
    const { container } = render(
      <_CustomTooltipForTest active={false} payload={[{ name: "X", value: 1, color: "#000" }]} label="2023" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when payload is empty", () => {
    const { container } = render(<_CustomTooltipForTest active payload={[]} label="2023" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders formatted SEK values for each entry", () => {
    const { container } = render(
      <_CustomTooltipForTest
        active
        label="2023"
        payload={[
          { name: "Revenue", value: 1_000_000, color: "#000" },
          { name: "Profit", value: null, color: "#f00" },
        ]}
      />
    );
    expect(container.textContent).toContain("2023");
    expect(container.textContent).toContain("1.0 mkr");
    expect(container.textContent).toContain("–");
  });
});

describe("CustomLegend", () => {
  it("returns null without payload", () => {
    const { container } = render(<_CustomLegendForTest />);
    expect(container.firstChild).toBeNull();
  });

  it("renders each payload entry", () => {
    const { container } = render(
      <_CustomLegendForTest payload={[{ value: "Omsättning", color: "#0f0" }, { value: "Resultat", color: "#f00" }]} />
    );
    expect(container.textContent).toContain("Omsättning");
    expect(container.textContent).toContain("Resultat");
  });
});
