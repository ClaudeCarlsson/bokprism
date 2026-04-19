"use client";

import { useState } from "react";

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export function Tabs({ tabs, defaultTab }: { tabs: Tab[]; defaultTab?: string }) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  // Arrow-key navigation per WAI-ARIA APG: Left/Right cycles through tabs,
  // Home/End jumps to first/last.
  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    const i = tabs.findIndex(t => t.id === activeTab);
    if (i < 0) return;
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    setActiveTab(tabs[next].id);
  }

  return (
    <div>
      <div
        className="flex gap-1 overflow-x-auto border-b border-zinc-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-zinc-700"
        role="tablist"
      >
        {tabs.map(tab => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={handleKeyDown}
              className={`shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                selected
                  ? "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map(tab => (
        <div
          key={tab.id}
          id={`panel-${tab.id}`}
          role="tabpanel"
          hidden={activeTab !== tab.id}
          className="py-6"
        >
          {activeTab === tab.id && tab.content}
        </div>
      ))}
    </div>
  );
}
