"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/lib/types";
import { formatSEK, formatOrgNumber } from "@/lib/format";

export function SearchBar({ autoFocus = false }: { autoFocus?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=10`, {
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data);
        setSelectedIndex(-1);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 150);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showResults || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      navigateToCompany(results[selectedIndex].org_number);
    } else if (e.key === "Escape") {
      setShowResults(false);
    }
  }

  function navigateToCompany(orgNumber: string) {
    setShowResults(false);
    router.push(`/company/${orgNumber}`);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl">
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          onKeyDown={handleKeyDown}
          placeholder="Sök företag eller org.nr..."
          autoFocus={autoFocus}
          className="w-full rounded-xl border border-zinc-200 bg-white py-3.5 pl-11 pr-4 text-base shadow-sm transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 sm:py-4 sm:pl-12 sm:text-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          aria-label="Sök företag"
          aria-expanded={showResults && results.length > 0}
          aria-controls="search-results"
          aria-activedescendant={selectedIndex >= 0 ? `result-${selectedIndex}` : undefined}
          role="combobox"
          aria-autocomplete="list"
        />
        {isLoading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600" />
          </div>
        )}
      </div>

      {showResults && results.length > 0 && (
        <ul
          id="search-results"
          role="listbox"
          className="absolute z-50 mt-2 w-full rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {results.map((result, i) => (
            <li
              key={result.org_number}
              id={`result-${i}`}
              role="option"
              aria-selected={i === selectedIndex}
              onClick={() => navigateToCompany(result.org_number)}
              className={`flex cursor-pointer items-center justify-between px-4 py-3 transition-colors first:rounded-t-xl last:rounded-b-xl ${
                i === selectedIndex
                  ? "bg-blue-50 dark:bg-blue-950"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                  {result.name}
                </div>
                <div className="text-sm text-zinc-500">
                  {formatOrgNumber(result.org_number)}
                  {result.filing_count > 1 && (
                    <span className="ml-2">· {result.filing_count} bokslut</span>
                  )}
                </div>
              </div>
              <div className="ml-4 text-right text-sm">
                {result.latest_revenue != null && (
                  <div className="text-zinc-700 dark:text-zinc-300">
                    {formatSEK(result.latest_revenue)}
                  </div>
                )}
                {result.latest_profit != null && (
                  <div className={result.latest_profit >= 0 ? "text-emerald-600" : "text-red-500"}>
                    {formatSEK(result.latest_profit)}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showResults && query.length >= 2 && results.length === 0 && !isLoading && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-zinc-200 bg-white p-6 text-center text-zinc-500 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          Inga företag hittades för &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}
