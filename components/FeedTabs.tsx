"use client";

import { type ReactNode, useState } from "react";
import { TRENDING_LABEL } from "@/lib/site";

type Tab = "following" | "everyone" | "trending";

export default function FeedTabs({
  initial,
  following,
  everyone,
  trending,
}: {
  initial: Tab;
  following: ReactNode;
  everyone: ReactNode;
  // Left out when the feature is switched off
  trending?: ReactNode;
}) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "everyone", label: "Everyone" },
    { id: "following", label: "Following" },
    ...(trending ? [{ id: "trending" as Tab, label: TRENDING_LABEL }] : []),
  ];
  const panels: Record<Tab, ReactNode> = { following, everyone, trending };

  const [active, setActive] = useState<Tab>(
    tabs.some((t) => t.id === initial) ? initial : "everyone",
  );

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
        className="flex gap-2 lg:mx-auto lg:w-[calc(50%-0.75rem)]"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`feed-tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`feed-panel-${t.id}`}
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
          id={`feed-panel-${t.id}`}
          aria-labelledby={`feed-tab-${t.id}`}
          hidden={active !== t.id}
        >
          {panels[t.id]}
        </div>
      ))}
    </div>
  );
}
