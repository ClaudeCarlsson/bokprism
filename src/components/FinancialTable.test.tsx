import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IncomeStatement, BalanceSheet, FinancialTable } from "./FinancialTable";
import type { FinancialHistory } from "@/lib/types";

describe("FinancialTable", () => {
  const mockHistory: FinancialHistory[] = [
    {
      period_end: "2022-12-31",
      metrics: {
        Nettoomsattning: 80_000_000,
        Rorelseresultat: 5_000_000,
        AretsResultat: 3_500_000,
      },
    },
    {
      period_end: "2023-12-31",
      metrics: {
        Nettoomsattning: 100_000_000,
        Rorelseresultat: 8_000_000,
        AretsResultat: 5_500_000,
      },
    },
  ];

  it("renders title", () => {
    render(
      <FinancialTable history={mockHistory} category="income" title="Resultaträkning" />
    );
    expect(screen.getAllByText("Resultaträkning").length).toBeGreaterThanOrEqual(1);
  });

  it("renders period headers", () => {
    render(
      <FinancialTable history={mockHistory} category="income" title="Test" />
    );
    expect(screen.getByText("2023")).toBeInTheDocument();
    expect(screen.getByText("2022")).toBeInTheDocument();
  });

  it("renders metric labels in Swedish", () => {
    render(
      <FinancialTable history={mockHistory} category="income" title="Test" />
    );
    expect(screen.getAllByText("Nettoomsättning").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Rörelseresultat").length).toBeGreaterThanOrEqual(1);
  });

  it("renders financial values", () => {
    render(
      <FinancialTable history={mockHistory} category="income" title="Test" />
    );
    expect(screen.getAllByText("100.0 mkr").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("80.0 mkr").length).toBeGreaterThanOrEqual(1);
  });

  it("returns null for empty metrics", () => {
    const emptyHistory: FinancialHistory[] = [
      { period_end: "2023-12-31", metrics: { Soliditet: 0.5 } },
    ];
    const { container } = render(
      <FinancialTable history={emptyHistory} category="income" title="Test" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("handles multiple category filter", () => {
    const history: FinancialHistory[] = [
      {
        period_end: "2023-12-31",
        metrics: {
          EgetKapital: 10_000_000,
          KortfristigaSkulder: 5_000_000,
        },
      },
    ];
    render(
      <FinancialTable
        history={history}
        category={["balance_equity", "balance_liability"]}
        title="EQ & Liab"
      />
    );
    expect(screen.getByText("Eget kapital")).toBeInTheDocument();
    expect(screen.getByText("Kortfristiga skulder")).toBeInTheDocument();
  });

  it("renders ratio metrics with the correct formatting", () => {
    const history: FinancialHistory[] = [
      {
        period_end: "2023-12-31",
        metrics: { Soliditet: 0.42, MedelantaletAnstallda: 15 },
      },
    ];
    render(<FinancialTable history={history} category="ratio" title="Nyckeltal" />);
    expect(screen.getByText("42.0%")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });
});

describe("IncomeStatement", () => {
  it("renders with income category", () => {
    const history: FinancialHistory[] = [
      { period_end: "2023-12-31", metrics: { Nettoomsattning: 50_000_000 } },
    ];
    render(<IncomeStatement history={history} />);
    expect(screen.getAllByText("Resultaträkning").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Nettoomsättning").length).toBeGreaterThanOrEqual(1);
  });
});

describe("BalanceSheet", () => {
  it("renders both assets and equity/liabilities sections", () => {
    const history: FinancialHistory[] = [
      {
        period_end: "2023-12-31",
        metrics: {
          Tillgangar: 20_000_000,
          EgetKapital: 10_000_000,
          KortfristigaSkulder: 5_000_000,
        },
      },
    ];
    render(<BalanceSheet history={history} />);
    expect(screen.getByText("Tillgångar")).toBeInTheDocument();
    expect(screen.getByText("Eget kapital & Skulder")).toBeInTheDocument();
  });
});
