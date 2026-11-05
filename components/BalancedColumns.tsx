"use client";

// ABOUTME: Lays out two columns on wide screens and hides what overhangs the shorter one.
// ABOUTME: The hidden items appear once the shorter column has grown to reach them.

import {
  type ReactNode,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
} from "react";
import { findColumnToTrim } from "@/lib/columnBalance";

function childElements(column: HTMLElement) {
  return [...column.children] as HTMLElement[];
}

export default function BalancedColumns({
  left,
  right,
  leftHasMore,
  rightHasMore,
}: {
  left: ReactNode;
  right: ReactNode;
  leftHasMore: boolean;
  rightHasMore: boolean;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const balance = useEffectEvent(() => {
    const leftColumn = leftRef.current;
    const rightColumn = rightRef.current;
    if (!leftColumn || !rightColumn) return;
    // Columns that aren't on screen have no sizes to compare
    if (leftColumn.offsetWidth === 0) return;

    // Everything has to be showing to be measured
    const leftItems = childElements(leftColumn);
    const rightItems = childElements(rightColumn);
    for (const item of [...leftItems, ...rightItems]) {
      item.style.display = "";
    }

    const bottoms = (items: HTMLElement[]) =>
      items.map((item) => item.getBoundingClientRect().bottom);
    const trim = findColumnToTrim(
      { itemBottoms: bottoms(leftItems), hasMore: leftHasMore },
      { itemBottoms: bottoms(rightItems), hasMore: rightHasMore },
    );
    if (!trim) return;

    const items = trim.column === "left" ? leftItems : rightItems;
    for (const item of items.slice(trim.visibleCount)) {
      item.style.display = "none";
    }
  });

  // Runs after every render, because each new page brings new items
  useLayoutEffect(() => {
    balance();
  });

  // The columns change height with the window, and when their tab is shown
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const observer = new ResizeObserver(() => balance());
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={gridRef}
      className="hidden gap-6 lg:grid lg:grid-cols-2 lg:items-start"
    >
      <div ref={leftRef} className="@container flex min-w-0 flex-col gap-4">
        {left}
      </div>
      <div ref={rightRef} className="@container flex min-w-0 flex-col gap-4">
        {right}
      </div>
    </div>
  );
}
