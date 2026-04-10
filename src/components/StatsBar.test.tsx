import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatsBar } from "./StatsBar";

describe("StatsBar", () => {
  const mockStats = {
    total_companies: 537349,
    total_filings: 1762986,
    total_data_points: 87689170,
    total_people: 509974,
    years_covered: "2017–2026",
  };

  it("renders all stat labels", () => {
    render(<StatsBar stats={mockStats} />);
    expect(screen.getByText("Företag")).toBeInTheDocument();
    expect(screen.getByText("Bokslut")).toBeInTheDocument();
    expect(screen.getByText("Datapunkter")).toBeInTheDocument();
    expect(screen.getByText("Personer")).toBeInTheDocument();
    expect(screen.getByText("År")).toBeInTheDocument();
  });

  it("formats company count with K suffix", () => {
    render(<StatsBar stats={mockStats} />);
    // 537,349 → "537K"
    expect(screen.getByText("537K")).toBeInTheDocument();
  });

  it("formats large numbers with M suffix", () => {
    render(<StatsBar stats={mockStats} />);
    // 1,762,986 → "1.8M"
    expect(screen.getByText("1.8M")).toBeInTheDocument();
    // 87,689,170 → "87.7M"
    expect(screen.getByText("87.7M")).toBeInTheDocument();
  });

  it("shows years covered", () => {
    render(<StatsBar stats={mockStats} />);
    expect(screen.getByText("2017–2026")).toBeInTheDocument();
  });
});
