import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { RankingSelector } from "./RankingSelector";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams("metric=X&order=desc"),
}));

beforeEach(() => pushMock.mockClear());

const metrics = [
  { key: "X", label: "Revenue" },
  { key: "Y", label: "Profit" },
];

describe("RankingSelector", () => {
  it("highlights the current metric", () => {
    render(<RankingSelector metrics={metrics} currentMetric="X" currentOrder="desc" />);
    const activeBtn = screen.getByText("Revenue");
    expect(activeBtn.className).toContain("blue");
  });

  it("navigates when switching metric", () => {
    render(<RankingSelector metrics={metrics} currentMetric="X" currentOrder="desc" />);
    fireEvent.click(screen.getByText("Profit"));
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("metric=Y"));
  });

  it("toggles order direction", () => {
    render(<RankingSelector metrics={metrics} currentMetric="X" currentOrder="desc" />);
    fireEvent.click(screen.getByText("Fallande"));
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("order=asc"));
  });

  it("shows ascending label when order is asc", () => {
    render(<RankingSelector metrics={metrics} currentMetric="X" currentOrder="asc" />);
    expect(screen.getByText("Stigande")).toBeInTheDocument();
  });
});
