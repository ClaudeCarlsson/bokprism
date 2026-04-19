import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tabs } from "./Tabs";

describe("Tabs", () => {
  const tabs = [
    { id: "tab1", label: "Tab One", content: <div data-testid="content-1">Content 1</div> },
    { id: "tab2", label: "Tab Two", content: <div data-testid="content-2">Content 2</div> },
    { id: "tab3", label: "Tab Three", content: <div data-testid="content-3">Content 3</div> },
  ];

  it("renders all tab buttons", () => {
    render(<Tabs tabs={tabs} />);
    expect(screen.getByText("Tab One")).toBeInTheDocument();
    expect(screen.getByText("Tab Two")).toBeInTheDocument();
    expect(screen.getByText("Tab Three")).toBeInTheDocument();
  });

  it("shows first tab content by default", () => {
    render(<Tabs tabs={tabs} />);
    expect(screen.getByTestId("content-1")).toBeVisible();
  });

  it("shows specified default tab content", () => {
    render(<Tabs tabs={tabs} defaultTab="tab2" />);
    expect(screen.getByTestId("content-2")).toBeVisible();
  });

  it("switches tab content on click", async () => {
    const user = userEvent.setup();
    render(<Tabs tabs={tabs} />);

    await user.click(screen.getByText("Tab Two"));
    expect(screen.getByTestId("content-2")).toBeVisible();
  });

  it("has correct ARIA role on tab buttons", () => {
    render(<Tabs tabs={tabs} />);
    const tabButtons = screen.getAllByRole("tab");
    expect(tabButtons).toHaveLength(3);
  });

  it("marks only active tab as selected", async () => {
    const user = userEvent.setup();
    render(<Tabs tabs={tabs} />);

    // Tab One is initially active
    expect(screen.getByText("Tab One")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Tab Two")).toHaveAttribute("aria-selected", "false");

    // Click Tab Two
    await user.click(screen.getByText("Tab Two"));
    expect(screen.getByText("Tab One")).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("Tab Two")).toHaveAttribute("aria-selected", "true");
  });
});
