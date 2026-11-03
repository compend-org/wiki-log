import Link from "next/link";
import type { ReactNode } from "react";
import { TRENDING_LABEL } from "@/lib/site";

type Tab = "following" | "everyone" | "trending";

export default function FeedTabs({
  active,
  showTrending,
  children,
}: {
  active: Tab;
  showTrending: boolean;
  // The feed for the active tab
  children: ReactNode;
}) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "everyone", label: "Everyone" },
    { id: "following", label: "Following" },
    ...(showTrending
      ? [{ id: "trending" as Tab, label: TRENDING_LABEL }]
      : []),
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 lg:max-w-none">
      <div
        role="tablist"
        aria-label="Feed"
        className="flex gap-2 lg:mx-auto lg:w-[calc(50%-0.75rem)]"
      >
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/?tab=${t.id}`}
            replace
            scroll={false}
            role="tab"
            aria-selected={active === t.id}
            className={`flex-1 border-2 px-4 py-2 text-center no-underline hover:no-underline ${active === t.id
                ? "border-dashed border-accent text-foreground"
                : "border-transparent text-muted hover:border-line"
              }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div role="tabpanel">{children}</div>
    </div>
  );
}