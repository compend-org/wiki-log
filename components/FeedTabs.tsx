"use client";

// ABOUTME: The home page's feed tabs. The server renders the tab the page opens on;
// ABOUTME: each other tab's feed is loaded when first opened, then kept and brought up to date.

import {
  type ReactNode,
  Suspense,
  startTransition,
  useEffect,
  useState,
} from "react";
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
  // How many times the server has rendered the page since it loaded, such as
  // after router.refresh(), and the feed it rendered last time
  const [served, setServed] = useState({ feed: initialFeed, count: 0 });
  // Each opened tab's feed, and the render of the page it is up to date with
  const [panels, setPanels] = useState<
    Partial<Record<Tab, { feed: ReactNode; served: number }>>
  >({ [initial]: { feed: initialFeed, served: 0 } });

  if (served.feed !== initialFeed) {
    const count = served.count + 1;
    setServed({ feed: initialFeed, count });
    setPanels((shown) => ({
      ...shown,
      [initial]: { feed: initialFeed, served: count },
    }));
  }

  // The open tab gets its feed the first time it is opened, and again if the
  // page has been rendered since. A feed brought up to date keeps the pages it
  // has already loaded and how far they reach.
  useEffect(() => {
    const panel = panels[active];
    const count = served.count;
    if (panel?.served === count) return;
    // Until the feed arrives, the one already there stays on screen
    setPanels((shown) => ({
      ...shown,
      [active]: { feed: panel?.feed ?? loading, served: count },
    }));
    loadFeedTab(active).then(
      (feed) =>
        startTransition(() =>
          // A feed asked for before a later render of the page is left out
          setPanels((shown) =>
            (shown[active]?.served ?? 0) > count
              ? shown
              : { ...shown, [active]: { feed, served: count } },
          ),
        ),
      () => {
        if (panel) return;
        setPanels((shown) => ({
          ...shown,
          [active]: {
            feed: (
              <p className="text-center text-danger">
                Couldn&apos;t load this feed. Reload the page to try again.
              </p>
            ),
            served: count,
          },
        }));
      },
    );
  }, [active, panels, served.count]);

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

      {/* One box for the panels, so the closed ones add no gaps */}
      <div>
        {tabs.map((t) => (
          <div
            key={t.id}
            role="tabpanel"
            id={`feed-panel-${t.id}`}
            aria-labelledby={`feed-tab-${t.id}`}
            // Closed panels are collapsed but stay laid out. Shown again from
            // display: none, Safari briefly sizes a feed as empty, and the
            // page jumps up. The open panel is at least a screen tall, so the
            // page doesn't get shorter while its feed loads or first appears.
            className={
              active === t.id ? "min-h-lvh" : "invisible h-0 overflow-hidden"
            }
          >
            <Suspense fallback={loading}>{panels[t.id]?.feed}</Suspense>
          </div>
        ))}
      </div>
    </div>
  );
}
