import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import ErrorPage from "./error";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    <a href={href}>{children}</a>,
}));

describe("ErrorPage", () => {
  it("renders the message and retry button", () => {
    const reset = vi.fn();
    const error = new Error("boom");
    const origConsole = console.error;
    console.error = () => {};
    const { container, getByRole } = render(<ErrorPage error={error} reset={reset} />);
    console.error = origConsole;
    expect(container.textContent).toContain("Något gick fel");
    fireEvent.click(getByRole("button", { name: /Försök igen/ }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
