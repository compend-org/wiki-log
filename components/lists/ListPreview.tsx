// ABOUTME: A one-line row of a list's item thumbnails, with "+N" for those that do not fit.
// ABOUTME: What fits follows the row's width without a script; hovering a tile names its item.
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  type CSSProperties,
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import ItemImage from "@/components/items/ItemImage";
import { firstLetter } from "@/lib/format";
import {
  type GroupPreview,
  previewLayout,
  slotsFor,
  tileSize,
} from "@/lib/lists/groupPreview";

type Thumb = {
  title: string;
  image_url: string | null;
  nsfw: boolean;
  // Hidden by the viewer: a blank tile, not named
  hidden?: boolean;
};
// A tooltip: what the tile is, and the name of its group if it has one
type Tip = { text: string; group: string | null; x: number; y: number };

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

// A tooltip's words: the group's name, emphasised, above the item's
function TipText({ tip }: { tip: Tip }) {
  return (
    <>
      {tip.group && <span className="block font-semibold">{tip.group}</span>}
      {tip.text}
    </>
  );
}

// What a "+N" tile shows: the number of items left out, over a dimmed picture
// of the first of them when it is known
function MoreFace({
  count,
  picture,
  className,
}: {
  count: number;
  picture?: Thumb;
  className: string;
}) {
  return (
    <span
      className={`relative flex items-center justify-center overflow-hidden rounded border border-line bg-surface text-sm font-semibold ${className}`}
    >
      {picture && (
        // The picture goes in a box of its own to fill the tile: an adult
        // item's picture sets its own position, which would put it beside
        // the number instead of behind it
        <span className="absolute inset-0 flex">
          <ItemImage
            src={picture.image_url}
            nsfw={picture.nsfw}
            hidden={picture.hidden}
            alt=""
            placeholder={firstLetter(picture.title)}
            className="h-full w-full"
            sourceWidth={120}
          />
        </span>
      )}
      <span
        className={`relative flex h-full w-full items-center justify-center ${
          picture ? "bg-background/70 text-foreground" : "text-muted"
        }`}
      >
        +{count}
      </span>
    </span>
  );
}

export default function ListPreview({
  thumbs,
  total,
  groups,
  href,
}: {
  thumbs: Thumb[];
  total: number;
  // A grouped list's groups, each with its size and first few items. Its row
  // is then laid out by script, to keep several groups in view.
  groups?: GroupPreview[] | null;
  // Where a click on a thumbnail goes: the list it belongs to
  href: string;
}) {
  const msg = useTranslations();
  const [tip, setTip] = useState<Tip | null>(null);
  const tipBox = useRef<HTMLDivElement>(null);

  // A grouped list's row holds as many tiles as its width allows, which is
  // known only once it is on screen
  const row = useRef<HTMLDivElement>(null);
  const [rowWidth, setRowWidth] = useState<number | null>(null);
  const capacity = rowWidth === null ? null : slotsFor(rowWidth);
  const grouped = !!groups && groups.length > 0;
  useIsoLayoutEffect(() => {
    const el = row.current;
    if (!grouped || !el) return;
    const measure = () => setRowWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [grouped]);

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

  // A tile in a group centres its tooltip on the whole group, so the tooltip
  // stays put as the pointer moves between the group's tiles
  function show(
    el: HTMLElement,
    text: string,
    group?: { id: string; name: string | null },
  ) {
    const r = el.getBoundingClientRect();
    let left = r.left;
    let right = r.right;
    if (group) {
      for (const tile of el.parentElement?.querySelectorAll(
        `[data-group="${group.id}"]`,
      ) ?? []) {
        const t = tile.getBoundingClientRect();
        left = Math.min(left, t.left);
        right = Math.max(right, t.right);
      }
    }
    setTip({
      text,
      group: group?.name ?? null,
      x: (left + right) / 2,
      y: r.bottom,
    });
  }
  const hide = () => setTip(null);

  // Every slot on the row shows a thumbnail, except that the last one shows
  // "+N" when some items don't fit. Which tiles are shown follows the row's
  // width, so it is right from the first paint.
  const shown = thumbs.slice(0, MOST_THUMBS);
  const more = (count: number) => msg("counts.moreItems", { count });
  // What a tile's tooltip calls its item; a hidden one isn't named
  const nameOf = (p: Thumb) => (p.hidden ? msg("hiding.tile") : p.title);

  // Each tile sits above the card's overlay link (relative z-10), so it can
  // show its own tooltip, and it leads to the same list when clicked
  const tile = "card-link relative z-10 flex h-14 w-14 shrink-0";
  // A grouped list's tiles are as wide as its row makes them (--tile)
  const groupTile =
    "card-link relative z-10 flex h-[var(--tile)] w-[var(--tile)] shrink-0";

  // A tile in place of the items that don't fit, shown only at the row
  // widths that `visibility` names. `picture` is the first of those items.
  function moreTile(count: number, visibility: string, picture?: Thumb) {
    return (
      <Link
        href={href}
        className={`${tile} ${visibility} no-underline`}
        onMouseEnter={(e) => show(e.currentTarget, more(count))}
        onMouseLeave={hide}
        onFocus={(e) => show(e.currentTarget, more(count))}
        onBlur={hide}
      >
        <MoreFace count={count} picture={picture} className="h-14 w-14" />
      </Link>
    );
  }

  // A grouped list draws each group in a dashed box. Every tile contributes
  // a slice of it: top and bottom edges, which run on through the gap to the
  // next tile, plus the left edge on the group's first tile and the right
  // edge on its last. The ends of a group have their pictures drawn narrower
  // so the boxes sit clear of each other; every tile keeps its size.
  const box = (first: boolean, last: boolean) =>
    [
      "before:absolute before:-bottom-0.5 before:-top-0.5 before:border-y before:border-dashed before:border-muted",
      first ? "before:left-0.5 before:border-l" : "before:left-0",
      last ? "before:right-0.5 before:border-r" : "before:-right-1",
      first && last
        ? "justify-center"
        : first
          ? "justify-end"
          : last
            ? "justify-start"
            : "",
    ].join(" ");
  const pictureWidth = (first: boolean, last: boolean) =>
    first && last
      ? "w-[calc(var(--tile)-0.5rem)]"
      : first || last
        ? "w-[calc(var(--tile)-0.25rem)]"
        : "w-[var(--tile)]";

  // The groups the row has no room for stand together in one last tile: a
  // dashed box like any group's, with the first picture of the first of them
  // under the number of items they hold. A single group is named in the tooltip.
  function restTile(count: number) {
    const left = groups?.slice(layout?.groups.length ?? 0) ?? [];
    const only = left.length === 1 ? left[0] : undefined;
    const picture = left[0]?.thumbs[0];
    const text =
      left.length > 1
        ? msg("counts.moreItemsInGroups", { items: count, groups: left.length })
        : more(count);
    return (
      <Link
        href={href}
        data-group={only?.id}
        className={`${groupTile} ${box(true, true)}`}
        onMouseEnter={(e) => show(e.currentTarget, text, only)}
        onMouseLeave={hide}
        onFocus={(e) => show(e.currentTarget, text, only)}
        onBlur={hide}
      >
        <MoreFace
          count={count}
          picture={picture}
          className="h-[var(--tile)] w-[calc(var(--tile)-0.5rem)]"
        />
      </Link>
    );
  }

  const tilePx =
    rowWidth !== null && capacity ? tileSize(rowWidth, capacity) : 56;
  const layout =
    grouped && groups && capacity !== null
      ? previewLayout(
          groups.map((g) => ({ size: g.size, available: g.thumbs.length })),
          capacity,
        )
      : null;

  if (grouped && groups) {
    return (
      <>
        <div
          ref={row}
          style={{ "--tile": `${tilePx}px` } as CSSProperties}
          // Its boxes reach 0.25rem past the pictures, so the row is that much
          // taller each side, cancelled out by negative margins
          className={`-my-1 flex h-[calc(var(--tile)+0.5rem)] gap-1 overflow-hidden py-1 ${
            layout ? "" : "invisible"
          }`}
        >
          {layout?.groups.map((shown, g) => {
            const group = groups[g];
            return (
              <Fragment key={group.id}>
                {group.thumbs.slice(0, shown.shown).map((p, i) => {
                  const name = nameOf(p);
                  const first = i === 0;
                  const last = shown.more === 0 && i === shown.shown - 1;
                  return (
                    <Link
                      // biome-ignore lint/suspicious/noArrayIndexKey: a fixed-order list whose entries can repeat
                      key={i}
                      href={href}
                      aria-label={name}
                      data-group={group.id}
                      className={`${groupTile} ${box(first, last)}`}
                      onMouseEnter={(e) => show(e.currentTarget, name, group)}
                      onMouseLeave={hide}
                      onFocus={(e) => show(e.currentTarget, name, group)}
                      onBlur={hide}
                    >
                      <ItemImage
                        src={p.image_url}
                        nsfw={p.nsfw}
                        hidden={p.hidden}
                        alt=""
                        placeholder={firstLetter(p.title)}
                        className={`h-[var(--tile)] rounded ${pictureWidth(first, last)}`}
                        sourceWidth={120}
                      />
                    </Link>
                  );
                })}
                {shown.more > 0 && (
                  <Link
                    href={href}
                    data-group={group.id}
                    className={`${groupTile} ${box(false, true)}`}
                    onMouseEnter={(e) =>
                      show(e.currentTarget, more(shown.more), group)
                    }
                    onMouseLeave={hide}
                    onFocus={(e) =>
                      show(e.currentTarget, more(shown.more), group)
                    }
                    onBlur={hide}
                  >
                    <MoreFace
                      count={shown.more}
                      picture={group.thumbs[shown.shown]}
                      className="h-[var(--tile)] w-[calc(var(--tile)-0.25rem)]"
                    />
                  </Link>
                )}
              </Fragment>
            );
          })}
          {layout && layout.rest > 0 && restTile(layout.rest)}
        </div>

        {tip && (
          <div
            ref={tipBox}
            role="tooltip"
            style={{ left: tip.x, top: tip.y + 8 }}
            className="card pointer-events-none fixed z-50 max-w-[16rem] -translate-x-1/2 px-2 py-1 text-xs"
          >
            <TipText tip={tip} />
          </div>
        )}
      </>
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
              aria-label={nameOf(p)}
              // The list's last item can take the last slot; any other needs
              // a slot after it for the rest
              className={`${tile} ${HIDDEN_UNLESS_MORE_THAN[i + 1 === total ? i : i + 1]}`}
              onMouseEnter={(e) => show(e.currentTarget, nameOf(p))}
              onMouseLeave={hide}
              onFocus={(e) => show(e.currentTarget, nameOf(p))}
              onBlur={hide}
            >
              <ItemImage
                src={p.image_url}
                nsfw={p.nsfw}
                hidden={p.hidden}
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
                p,
              )}
          </Fragment>
        ))}
        {total > shown.length &&
          moreTile(
            total - shown.length,
            HIDDEN_UNLESS_MORE_THAN[shown.length],
            thumbs[shown.length],
          )}
      </div>

      {tip && (
        <div
          ref={tipBox}
          role="tooltip"
          style={{ left: tip.x, top: tip.y + 8 }}
          className="card pointer-events-none fixed z-50 max-w-[16rem] -translate-x-1/2 px-2 py-1 text-xs"
        >
          <TipText tip={tip} />
        </div>
      )}
    </>
  );
}
