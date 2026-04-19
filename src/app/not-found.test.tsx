import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import NotFound from "./not-found";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    <a href={href}>{children}</a>,
}));

describe("NotFound page", () => {
  it("renders 404 and a home link", () => {
    const { container, getByRole } = render(<NotFound />);
    expect(container.textContent).toContain("404");
    expect(getByRole("link", { name: /Tillbaka/ })).toHaveAttribute("href", "/");
  });
});
