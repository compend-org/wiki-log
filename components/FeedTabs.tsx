"use client";

// ABOUTME: The home page's feed tabs. The server renders the tab the page opens on;
// ABOUTME: each other tab's feed is loaded the first time it is opened, then kept.

import { type ReactNode, Suspense, useEffect, useState } from "react";
import { loadFeedTab } from "@/app/feedActions";
import { FEATURES } from "@/lib/features";
import { TRENDING_LABEL } from "@/lib/site";

type Tab = "following" | "everyone" | "trending";

const loading = <p className="py-12 text-center text-muted">Loading…</p>;

export default function FeedTabs({
  initial,
  initialFeed,
}: {
  initial: Tab;
  // The feed of the `initial` tab
  initialFeed: ReactNode;
}) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "everyone", label: "Everyone" },
    { id: "following", label: "Following" },
    ...(FEATURES.trending
      ? [{ id: "trending" as Tab, label: TRENDING_LABEL }]
      : []),
  ];

  const [active, setActive] = useState<Tab>(
    tabs.some((t) => t.id === initial) ? initial : "everyone",
  );
  // The feeds of the tabs opened since the page loaded
  const [loaded, setLoaded] = useState<Partial<Record<Tab, ReactNode>>>({});
  const feedOf = (tab: Tab) =>
    loaded[tab] ?? (tab === initial ? initialFeed : undefined);

  // A tab without a feed yet gets one as soon as it is opened
  const activeMissing = feedOf(active) === undefined;
  useEffect(() => {
    if (!activeMissing) return;
    setLoaded((shown) => ({ ...shown, [active]: loading }));
    loadFeedTab(active)
      .catch(() => (
        <p className="text-center text-danger">
          Couldn&apos;t load this feed. Reload the page to try again.
        </p>
      ))
      .then((feed) => setLoaded((shown) => ({ ...shown, [active]: feed })));
  }, [active, activeMissing]);

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
          <Suspense fallback={loading}>{feedOf(t.id)}</Suspense>
        </div>
      ))}
    </div>
  );
}
