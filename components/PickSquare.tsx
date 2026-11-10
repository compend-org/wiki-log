"use client";

import Link from "next/link";
import ItemImage from "@/components/ItemImage";
import { track } from "@/lib/analytics";
import type { Pick } from "@/lib/dailyPicks";

export default function PickSquare({
  heading,
  kind,
  pick,
}: {
  heading: string;
  kind: "popular" | "unpopular";
  pick: Pick | null;
}) {
  const box =
    "card flex w-full max-w-[11rem] flex-col items-center gap-2 p-2 text-center";
  const label =
    "text-[0.65rem] font-semibold uppercase tracking-wide text-muted";

  if (!pick) {
    return (
      <div className={`${box} justify-center py-6`}>
        <span className={label}>{heading}</span>
        <span className="text-xs text-muted">
          Nothing rated in the last 24 hours
        </span>
      </div>
    );
  }

  return (
    <Link
      href={`/item/${pick.itemId}`}
      title={pick.title}
      className={`${box} no-underline`}
      onClick={() => track("daily_pick_clicked", { kind })}
    >
      <span className={label}>{heading}</span>

      {pick.imageUrl ? (
        // Natural proportions, never taller than 10rem or wider than the box
        <ItemImage
          src={pick.imageUrl}
          alt={pick.title}
          className="h-auto max-h-40 w-auto max-w-full"
        />
      ) : (
        <ItemImage
          src={null}
          alt={pick.title}
          ratio={1.5}
          className="h-28 w-full"
        />
      )}

      <span className="w-full truncate text-sm font-semibold">
        {pick.title}
      </span>
      <span className="text-xs text-muted">
        <span className="text-star">★</span> {pick.average.toFixed(1)} ·{" "}
        {pick.count} {pick.count === 1 ? "rating" : "ratings"}
      </span>
    </Link>
  );
}
