import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    <a href={href}>{children}</a>,
}));
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "font-sans" }),
  Geist_Mono: () => ({ variable: "font-mono" }),
}));
// Don't let Next.js try to load globals.css through the jsdom test runner.
vi.mock("./globals.css", () => ({}));

describe("RootLayout", () => {
  it("wraps children in navbar + footer chrome", async () => {
    const RootLayout = (await import("./layout")).default;
    const tree = RootLayout({ children: <div data-testid="page-content">hello</div> });
    // RootLayout returns <html><body>…</body></html>; render the body contents
    // directly to avoid jsdom errors about nested html elements.
    const body = (tree as React.ReactElement<{ children: React.ReactNode }>)
      .props.children as React.ReactElement<{ children: React.ReactNode }>;
    const { container, getByTestId } = render(<>{body.props.children}</>);
    expect(container.textContent).toContain("BokPrism");
    expect(container.textContent).toContain("Topplistor");
    expect(container.textContent).toContain("Bolagsverket");
    expect(getByTestId("page-content")).toBeInTheDocument();
  });

  it("exports page metadata", async () => {
    const mod = await import("./layout");
    expect(mod.metadata.title).toMatch(/BokPrism/);
    expect(mod.viewport.width).toBe("device-width");
  });
});
