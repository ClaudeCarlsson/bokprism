import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBar } from "./SearchBar";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockPush.mockClear();
  mockFetch.mockClear();
});

describe("SearchBar", () => {
  it("renders search input with placeholder", () => {
    render(<SearchBar />);
    expect(screen.getByPlaceholderText(/Sök företag/)).toBeInTheDocument();
  });

  it("has combobox role", () => {
    render(<SearchBar />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("auto-focuses when autoFocus is true", () => {
    render(<SearchBar autoFocus />);
    expect(screen.getByRole("combobox")).toHaveFocus();
  });

  it("fetches results after typing 2+ characters", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<SearchBar />);
    await user.type(screen.getByRole("combobox"), "AB");

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/api/search");
    });
  });

  it("does not fetch for single character", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    await user.type(screen.getByRole("combobox"), "A");

    await new Promise(r => setTimeout(r, 200));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("displays search results", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            org_number: "556070-1715",
            name: "Test Company AB",
            latest_revenue: 1_000_000,
            latest_profit: 100_000,
            latest_period: "2024-12-31",
            filing_count: 2,
          },
        ]),
    });

    render(<SearchBar />);
    await user.type(screen.getByRole("combobox"), "Test");

    await waitFor(() => {
      expect(screen.getByText("Test Company AB")).toBeInTheDocument();
    });
  });

  it("navigates on result click", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            org_number: "556070-1715",
            name: "Click Me AB",
            latest_revenue: null,
            latest_profit: null,
            latest_period: null,
            filing_count: 1,
          },
        ]),
    });

    render(<SearchBar />);
    await user.type(screen.getByRole("combobox"), "Click");

    await waitFor(() => {
      expect(screen.getByText("Click Me AB")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Click Me AB"));
    expect(mockPush).toHaveBeenCalledWith("/company/556070-1715");
  });

  it("shows no results message for empty results", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    render(<SearchBar />);
    await user.type(screen.getByRole("combobox"), "nonexistent");

    await waitFor(() => {
      expect(screen.getByText(/Inga företag hittades/)).toBeInTheDocument();
    });
  });

  it("supports keyboard navigation with ArrowDown + Enter", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { org_number: "111111-1111", name: "First AB", latest_revenue: null, latest_profit: null, latest_period: null, filing_count: 1 },
          { org_number: "222222-2222", name: "Second AB", latest_revenue: null, latest_profit: null, latest_period: null, filing_count: 1 },
        ]),
    });

    render(<SearchBar />);
    await user.type(screen.getByRole("combobox"), "test");

    await waitFor(() => {
      expect(screen.getByText("First AB")).toBeInTheDocument();
    });

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(mockPush).toHaveBeenCalledWith("/company/111111-1111");
  });

  it("clamps ArrowDown at the last result and ArrowUp at -1", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { org_number: "111111-1111", name: "Only AB", latest_revenue: null, latest_profit: null, latest_period: null, filing_count: 1 },
        ]),
    });

    render(<SearchBar />);
    await user.type(screen.getByRole("combobox"), "o");
    await user.type(screen.getByRole("combobox"), "k");

    await waitFor(() => expect(screen.getByText("Only AB")).toBeInTheDocument());

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowUp}");
    await user.keyboard("{ArrowUp}");
    await user.keyboard("{Enter}"); // Enter with -1 index → no nav
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("hides the dropdown on Escape", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { org_number: "111111-1111", name: "Hideme AB", latest_revenue: null, latest_profit: null, latest_period: null, filing_count: 1 },
        ]),
    });

    render(<SearchBar />);
    await user.type(screen.getByRole("combobox"), "hide");
    await waitFor(() => expect(screen.getByText("Hideme AB")).toBeInTheDocument());

    await user.keyboard("{Escape}");
    expect(screen.queryByText("Hideme AB")).not.toBeInTheDocument();
  });

  it("closes the dropdown when clicking outside the container", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          { org_number: "111111-1111", name: "Outside AB", latest_revenue: null, latest_profit: null, latest_period: null, filing_count: 1 },
        ]),
    });

    render(
      <div>
        <SearchBar />
        <button type="button">outside</button>
      </div>
    );
    await user.type(screen.getByRole("combobox"), "out");
    await waitFor(() => expect(screen.getByText("Outside AB")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "outside" }));
    expect(screen.queryByText("Outside AB")).not.toBeInTheDocument();
  });

  it("swallows AbortError when a request is cancelled mid-flight", async () => {
    const user = userEvent.setup();
    mockFetch.mockImplementation((_url: string, { signal }: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () =>
          reject(Object.assign(new DOMException("aborted", "AbortError")))
        );
      })
    );
    render(<SearchBar />);
    await user.type(screen.getByRole("combobox"), "ab");
    // Typing a third char aborts the first request.
    await user.type(screen.getByRole("combobox"), "c");
    // No unhandled rejection. Assert no crash by checking the combobox is still rendered.
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
