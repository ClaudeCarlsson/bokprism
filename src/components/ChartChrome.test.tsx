import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ChartTooltip, ChartLegend } from "./ChartChrome";

describe("ChartTooltip", () => {
  it("returns null when not active", () => {
    const { container } = render(
      <ChartTooltip active={false} payload={[{ name: "X", value: 1, color: "#000" }]} label="2023" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when payload is empty", () => {
    const { container } = render(<ChartTooltip active payload={[]} label="2023" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders formatted SEK values for each entry and a dash for null", () => {
    const { container } = render(
      <ChartTooltip
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

describe("ChartLegend", () => {
  it("returns null without payload", () => {
    const { container } = render(<ChartLegend />);
    expect(container.firstChild).toBeNull();
  });

  it("renders each payload entry", () => {
    const { container } = render(
      <ChartLegend payload={[{ value: "Omsättning", color: "#0f0" }, { value: "Resultat", color: "#f00" }]} />
    );
    expect(container.textContent).toContain("Omsättning");
    expect(container.textContent).toContain("Resultat");
  });
});
