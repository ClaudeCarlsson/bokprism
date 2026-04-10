import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompanyCard } from "./CompanyCard";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe("CompanyCard", () => {
  it("renders company name and org number", () => {
    render(<CompanyCard orgNumber="556070-1715" name="H & M Hennes & Mauritz GBC AB" />);
    expect(screen.getByText("H & M Hennes & Mauritz GBC AB")).toBeInTheDocument();
    expect(screen.getByText("556070-1715")).toBeInTheDocument();
  });

  it("links to company page", () => {
    render(<CompanyCard orgNumber="556070-1715" name="Test AB" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/company/556070-1715");
  });

  it("shows revenue when provided", () => {
    render(<CompanyCard orgNumber="556070-1715" name="Test AB" revenue={50_000_000} />);
    expect(screen.getByText(/50\.0 mkr/)).toBeInTheDocument();
  });

  it("shows positive profit in green", () => {
    render(<CompanyCard orgNumber="556070-1715" name="Test AB" profit={1_000_000} />);
    const el = screen.getByText(/1\.0 mkr/);
    expect(el.className).toContain("emerald");
  });

  it("shows negative profit in red", () => {
    render(<CompanyCard orgNumber="556070-1715" name="Test AB" profit={-500_000} />);
    const el = screen.getByText(/-500 tkr/);
    expect(el.className).toContain("red");
  });

  it("shows role when provided", () => {
    render(<CompanyCard orgNumber="556070-1715" name="Test AB" role="Styrelseledamot" />);
    expect(screen.getByText("Styrelseledamot")).toBeInTheDocument();
  });

  it("shows period end when provided", () => {
    render(<CompanyCard orgNumber="556070-1715" name="Test AB" periodEnd="2024-12-31" />);
    expect(screen.getByText("2024-12-31")).toBeInTheDocument();
  });
});
