"use client";

import { useState, type ReactNode } from "react";

type Tab = "following" | "everyone";

const TABS: { id: Tab; label: string }[] = [
  { id: "everyone", label: "Everyone" },
  { id: "following", label: "Following" },
];

export default function FeedTabs({
  initial,
  following,
  everyone,
}: {
  initial: Tab;
  following: ReactNode;
  everyone: ReactNode;
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 lg:max-w-none">
      <div
        role="tablist"
        aria-label="Feed"
        className="flex border-b border-line lg:mx-auto lg:w-[calc(50%-0.75rem)]"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`feed-tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`feed-panel-${t.id}`}
            onClick={() => choose(t.id)}
            className={`-mb-px flex-1 border-b-2 px-4 py-2 text-center ${active === t.id
                ? "border-accent text-foreground"
                : "border-transparent text-muted"
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="feed-panel-following"
        aria-labelledby="feed-tab-following"
        hidden={active !== "following"}
      >
        {following}
      </div>
      <div
        role="tabpanel"
        id="feed-panel-everyone"
        aria-labelledby="feed-tab-everyone"
        hidden={active !== "everyone"}
      >
        {everyone}
      </div>
    </div>
  );
}