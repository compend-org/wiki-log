// ABOUTME: Works out how much of the taller of two side-by-side columns to show.
// ABOUTME: Keeps both ending close together while the shorter one still has more to load.

export type ColumnLayout = {
  // Where each item in the column ends, from top to bottom
  itemBottoms: number[];
  hasMore: boolean;
};

export type ColumnTrim = {
  column: "left" | "right";
  visibleCount: number;
};

// A shorter column that has run out will never catch up, so the taller one
// then stays whole.
export function findColumnToTrim(
  left: ColumnLayout,
  right: ColumnLayout,
): ColumnTrim | null {
  const leftBottom = left.itemBottoms.at(-1) ?? 0;
  const rightBottom = right.itemBottoms.at(-1) ?? 0;
  if (leftBottom === rightBottom) return null;

  const [taller, shorter, column] =
    leftBottom > rightBottom
      ? ([left, right, "left"] as const)
      : ([right, left, "right"] as const);
  if (!shorter.hasMore) return null;

  const limit = Math.min(leftBottom, rightBottom);
  const visibleCount = taller.itemBottoms.filter((b) => b <= limit).length;
  return { column, visibleCount };
}
