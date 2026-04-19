import { describe, it, expect, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import { CompanyCharts } from "./CompanyCharts";
import type { FinancialHistory } from "@/lib/types";

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 300 });
});

describe("CompanyCharts", () => {
  it("shows the empty-state message when history is empty", () => {
    const { container } = render(<CompanyCharts history={[]} />);
    expect(container.textContent).toContain("Ingen historisk data");
  });

  it("renders RevenueChart and BalanceChart with one period", () => {
    const history: FinancialHistory[] = [
      { period_end: "2023-12-31", metrics: { RorelseintakterLagerforandringarMm: 100 } },
    ];
    expect(() => render(<CompanyCharts history={history} />)).not.toThrow();
  });

  it("adds ProfitabilityChart when there are 2+ periods", () => {
    const history: FinancialHistory[] = [
      { period_end: "2022-12-31", metrics: { Rorelseresultat: 10 } },
      { period_end: "2023-12-31", metrics: { Rorelseresultat: 20 } },
    ];
    expect(() => render(<CompanyCharts history={history} />)).not.toThrow();
  });
});
