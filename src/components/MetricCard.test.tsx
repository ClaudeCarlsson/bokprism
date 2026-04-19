import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricCard } from "./MetricCard";

describe("MetricCard", () => {
  it("renders a revenue metric", () => {
    render(<MetricCard metric="Nettoomsattning" value={101_763_063} />);
    expect(screen.getByText("Nettoomsättning")).toBeInTheDocument();
    expect(screen.getByText("101.8 mkr")).toBeInTheDocument();
  });

  it("renders null value as dash", () => {
    render(<MetricCard metric="Nettoomsattning" value={null} />);
    expect(screen.getByText("–")).toBeInTheDocument();
  });

  it("renders equity ratio as percentage", () => {
    render(<MetricCard metric="Soliditet" value={0.42} />);
    expect(screen.getByText("42.0%")).toBeInTheDocument();
  });

  it("renders employee count", () => {
    render(<MetricCard metric="MedelantaletAnstallda" value={150} />);
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  it("shows trend indicator when previous value provided", () => {
    render(<MetricCard metric="Nettoomsattning" value={110_000_000} previousValue={100_000_000} />);
    expect(screen.getByText("↑")).toBeInTheDocument();
    expect(screen.getByText("10.0%")).toBeInTheDocument();
  });

  it("shows downward trend", () => {
    render(<MetricCard metric="Nettoomsattning" value={90_000_000} previousValue={100_000_000} />);
    expect(screen.getByText("↓")).toBeInTheDocument();
  });

  it("handles unknown metric gracefully", () => {
    render(<MetricCard metric="UnknownMetric" value={12345} />);
    expect(screen.getByText("UnknownMetric")).toBeInTheDocument();
  });

  it("applies compact style when compact prop is true", () => {
    const { container } = render(
      <MetricCard metric="Nettoomsattning" value={1_000_000} compact />
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("p-3");
  });

  it("shows flat trend arrow for near-zero change", () => {
    render(<MetricCard metric="Nettoomsattning" value={100_500_000} previousValue={100_000_000} />);
    expect(screen.getByText("→")).toBeInTheDocument();
  });
});
