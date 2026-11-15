// ABOUTME: A one-line row of a list's item thumbnails, with "+N" for those that do not fit.
// ABOUTME: What fits follows the row's width without a script; hovering a tile names its item.
"use client";

import Link from "next/link";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import ItemImage from "@/components/items/ItemImage";
import { firstLetter } from "@/lib/format";

type Thumb = { title: string; image_url: string | null; nsfw: boolean };
type Tip = { text: string; x: number; y: number };

// useLayoutEffect only produces a warning when rendered on the server
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// The row holds as many 3.5rem tiles, 0.25rem apart, as its width allows.
// It has room for more than k tiles once it is at least (3.75k + 3.5)rem wide.
// Tailwind needs each class written out in full, so these list every k a
// preview can reach: hidden while there is room for at most k tiles...
const HIDDEN_UNLESS_MORE_THAN = [
  "",
  "@max-[7.25rem]:hidden",
  "@max-[11rem]:hidden",
  "@max-[14.75rem]:hidden",
  "@max-[18.5rem]:hidden",
  "@max-[22.25rem]:hidden",
  "@max-[26rem]:hidden",
  "@max-[29.75rem]:hidden",
  "@max-[33.5rem]:hidden",
  "@max-[37.25rem]:hidden",
  "@max-[41rem]:hidden",
  "@max-[44.75rem]:hidden",
  "@max-[48.5rem]:hidden",
];
// ...and hidden once there is room for more than k tiles
const HIDDEN_IF_MORE_THAN = [
  "@min-[3.5rem]:hidden",
  "@min-[7.25rem]:hidden",
  "@min-[11rem]:hidden",
  "@min-[14.75rem]:hidden",
  "@min-[18.5rem]:hidden",
  "@min-[22.25rem]:hidden",
  "@min-[26rem]:hidden",
  "@min-[29.75rem]:hidden",
  "@min-[33.5rem]:hidden",
  "@min-[37.25rem]:hidden",
  "@min-[41rem]:hidden",
  "@min-[44.75rem]:hidden",
  "@min-[48.5rem]:hidden",
];
// The most thumbnails the classes above can place
const MOST_THUMBS = HIDDEN_UNLESS_MORE_THAN.length - 1;

export default function ListPreview({
  thumbs,
  total,
  href,
}: {
  thumbs: Thumb[];
  total: number;
  // Where a click on a thumbnail goes: the list it belongs to
  href: string;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const tipBox = useRef<HTMLDivElement>(null);

  // The tooltip is positioned against the window, so it hides on scroll
  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [tip]);

  // The tooltip centres on its tile, moving only as far as it must to stay
  // inside the window
  useIsoLayoutEffect(() => {
    const box = tipBox.current;
    if (!tip || !box) return;
    const edge = box.offsetWidth / 2 + 8;
    const x = Math.min(Math.max(tip.x, edge), window.innerWidth - edge);
    box.style.left = `${x}px`;
  }, [tip]);

  function show(el: HTMLElement, text: string) {
    const r = el.getBoundingClientRect();
    setTip({ text, x: r.left + r.width / 2, y: r.bottom });
  }
  const hide = () => setTip(null);

  // Every slot on the row shows a thumbnail, except that the last one shows
  // "+N" when some items don't fit. Which tiles are shown follows the row's
  // width, so it is right from the first paint.
  const shown = thumbs.slice(0, MOST_THUMBS);
  const more = (count: number) =>
    `${count} more ${count === 1 ? "item" : "items"}`;

  // Each tile sits above the card's overlay link (relative z-10), so it can
  // show its own tooltip, and it leads to the same list when clicked
  const tile = "card-link relative z-10 flex h-14 w-14 shrink-0";

  // A tile in place of the items that don't fit, shown only at the row
  // widths that `visibility` names
  function moreTile(count: number, visibility: string) {
    return (
      <Link
        href={href}
        className={`${tile} ${visibility} items-center justify-center border border-line bg-surface text-sm font-semibold text-muted no-underline`}
        onMouseEnter={(e) => show(e.currentTarget, more(count))}
        onMouseLeave={hide}
        onFocus={(e) => show(e.currentTarget, more(count))}
        onBlur={hide}
      >
        +{count}
      </Link>
    );
  }

  return (
    <>
      <div className="@container flex h-14 flex-wrap gap-1 overflow-hidden">
        {shown.map((p, i) => (
          <Fragment
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed-order list whose entries can repeat
            key={i}
          >
            <Link
              href={href}
              aria-label={p.title}
              // The list's last item can take the last slot; any other needs
              // a slot after it for the rest
              className={`${tile} ${HIDDEN_UNLESS_MORE_THAN[i + 1 === total ? i : i + 1]}`}
              onMouseEnter={(e) => show(e.currentTarget, p.title)}
              onMouseLeave={hide}
              onFocus={(e) => show(e.currentTarget, p.title)}
              onBlur={hide}
            >
              <ItemImage
                src={p.image_url}
                nsfw={p.nsfw}
                alt=""
                placeholder={firstLetter(p.title)}
                className="h-14 w-14 rounded"
                sourceWidth={120}
              />
            </Link>
            {total > i + 1 &&
              moreTile(
                total - i,
                `${HIDDEN_UNLESS_MORE_THAN[i]} ${HIDDEN_IF_MORE_THAN[i + 1]}`,
              )}
          </Fragment>
        ))}
        {total > shown.length &&
          moreTile(total - shown.length, HIDDEN_UNLESS_MORE_THAN[shown.length])}
      </div>

      {tip && (
        <div
          ref={tipBox}
          role="tooltip"
          style={{ left: tip.x, top: tip.y + 8 }}
          className="card pointer-events-none fixed z-50 max-w-[16rem] -translate-x-1/2 px-2 py-1 text-xs"
        >
          {tip.text}
        </div>
      )}
    </>
  );
}
