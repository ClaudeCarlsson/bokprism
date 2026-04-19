import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PersonList } from "./PersonList";
import type { CompanyRole } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe("PersonList", () => {
  const mockPeople: CompanyRole[] = [
    { person_id: 1, first_name: "Anna", last_name: "Svensson", role: "Verkställande direktör", filing_period_end: "2024-12-31" },
    { person_id: 2, first_name: "Erik", last_name: "Johansson", role: "Styrelseledamot", filing_period_end: "2024-12-31" },
    { person_id: 3, first_name: "Maria", last_name: "Andersson", role: "Revisor", filing_period_end: "2024-12-31" },
  ];

  it("renders section heading", () => {
    render(<PersonList people={mockPeople} />);
    expect(screen.getByText("Styrelse & Ledning")).toBeInTheDocument();
  });

  it("renders all people names", () => {
    render(<PersonList people={mockPeople} />);
    expect(screen.getByText(/Anna.*Svensson/)).toBeInTheDocument();
    expect(screen.getByText(/Erik.*Johansson/)).toBeInTheDocument();
    expect(screen.getByText(/Maria.*Andersson/)).toBeInTheDocument();
  });

  it("shows all roles", () => {
    render(<PersonList people={mockPeople} />);
    expect(screen.getAllByText("Verkställande direktör").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Styrelseledamot").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Revisor").length).toBeGreaterThanOrEqual(1);
  });

  it("links to person pages", () => {
    render(<PersonList people={mockPeople} />);
    const links = screen.getAllByRole("link");
    expect(links.some(l => l.getAttribute("href") === "/person/1")).toBe(true);
    expect(links.some(l => l.getAttribute("href") === "/person/2")).toBe(true);
  });

  it("sorts VD before other roles", () => {
    render(<PersonList people={mockPeople} />);
    const names = screen.getAllByRole("link").map(el => el.textContent);
    // VD (Anna) should appear before Revisor (Maria)
    const annaIndex = names.findIndex(n => n?.includes("Anna"));
    const mariaIndex = names.findIndex(n => n?.includes("Maria"));
    expect(annaIndex).toBeLessThan(mariaIndex);
  });

  it("renders nothing for empty list", () => {
    const { container } = render(<PersonList people={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("deduplicates people appearing multiple times", () => {
    const duped: CompanyRole[] = [
      { person_id: 1, first_name: "Anna", last_name: "S", role: "VD", filing_period_end: "2024-12-31" },
      { person_id: 1, first_name: "Anna", last_name: "S", role: "VD", filing_period_end: "2023-12-31" },
    ];
    render(<PersonList people={duped} />);
    expect(screen.getAllByText(/Anna.*S/)).toHaveLength(1);
  });

  it("breaks role-order ties alphabetically by last name", () => {
    const sameRole: CompanyRole[] = [
      { person_id: 1, first_name: "Bertil", last_name: "Ö", role: "Styrelseledamot", filing_period_end: "2024-12-31" },
      { person_id: 2, first_name: "Anna", last_name: "A", role: "Styrelseledamot", filing_period_end: "2024-12-31" },
    ];
    render(<PersonList people={sameRole} />);
    const names = screen.getAllByRole("link").map(l => l.textContent);
    expect(names[0]).toContain("Anna");
    expect(names[1]).toContain("Bertil");
  });

  it("places unknown roles at the end", () => {
    const mix: CompanyRole[] = [
      { person_id: 1, first_name: "Oddly", last_name: "Roled", role: "Konsult", filing_period_end: "2024-12-31" },
      { person_id: 2, first_name: "Known", last_name: "Role", role: "Styrelseledamot", filing_period_end: "2024-12-31" },
    ];
    render(<PersonList people={mix} />);
    const names = screen.getAllByRole("link").map(l => l.textContent);
    expect(names[0]).toContain("Known");
    expect(names[1]).toContain("Oddly");
  });
});
