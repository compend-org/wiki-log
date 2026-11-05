"use client";

import { type ReactNode, useState } from "react";

type Tab = "followers" | "following";

export default function PeopleTabs({
  initial,
  tabs,
}: {
  initial: Tab;
  tabs: { id: Tab; label: string; content: ReactNode }[];
}) {
  const [active, setActive] = useState<Tab>(initial);

  function choose(tab: Tab) {
    setActive(tab);
    // Keep the address in step without navigating anywhere
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="People" className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`people-tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`people-panel-${t.id}`}
            onClick={() => choose(t.id)}
            className={`flex-1 border-2 px-4 py-2 text-center ${
              active === t.id
                ? "border-dashed border-accent text-foreground"
                : "border-transparent text-muted hover:border-line"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`people-panel-${t.id}`}
          aria-labelledby={`people-tab-${t.id}`}
          hidden={active !== t.id}
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}