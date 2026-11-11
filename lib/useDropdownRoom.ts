// ABOUTME: Works out where a search box's list of results has room to open: below the box,
// ABOUTME: or above it when the on-screen keyboard or the bottom of the screen leaves too little room.
import { type RefObject, useLayoutEffect, useState } from "react";

// Space kept free between the list and the edge of what's visible
const MARGIN = 8;

// Room for about five results: with this much below the box, the list
// opens below it even if it then has to scroll
const ENOUGH_BELOW = 200;

export type DropdownRoom = { above: boolean; maxHeight: number };

// Where a list of up to `wanted` pixels tall fits next to `anchor` while
// `open`. It goes below when there's enough room there or more than above,
// and is cut to the room it has. Phones' keyboards cover the bottom of the
// page without resizing it, so the room is measured against what's actually
// visible.
export function useDropdownRoom(
  anchor: RefObject<HTMLElement | null>,
  open: boolean,
  wanted: number,
): DropdownRoom {
  const [room, setRoom] = useState<DropdownRoom>({
    above: false,
    maxHeight: wanted,
  });

  useLayoutEffect(() => {
    if (!open) return;

    function measure() {
      const box = anchor.current?.getBoundingClientRect();
      if (!box) return;
      // The visible part of the page, in the same coordinates as `box`.
      // Browsers measure `box` from different places when a keyboard is up
      // (Chrome from the layout viewport, Safari from what's visible), but
      // the page scroll of each is consistent with it.
      const view = window.visualViewport;
      const visibleTop = view ? view.pageTop - window.scrollY : 0;
      const visibleBottom =
        visibleTop + (view ? view.height : window.innerHeight);
      const below = visibleBottom - box.bottom - MARGIN;
      const aboveRoom = box.top - visibleTop - MARGIN;
      const above = below < Math.min(wanted, ENOUGH_BELOW) && aboveRoom > below;
      const maxHeight = Math.max(
        0,
        Math.min(wanted, above ? aboveRoom : below),
      );
      setRoom((previous) =>
        previous.above === above && previous.maxHeight === maxHeight
          ? previous
          : { above, maxHeight },
      );
    }

    measure();
    const view = window.visualViewport;
    view?.addEventListener("resize", measure);
    view?.addEventListener("scroll", measure);
    window.addEventListener("scroll", measure);
    return () => {
      view?.removeEventListener("resize", measure);
      view?.removeEventListener("scroll", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [anchor, open, wanted]);

  return room;
}
