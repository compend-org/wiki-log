// ABOUTME: Puts pinned posts and lists at a chosen place in the Trending ranking.
// ABOUTME: Pure, so the placing can be tested without a database.
export type RankedRow = { row_id: string; recent_likes: number | string };
export type TrendingPin = {
  log_id: string | null;
  list_id: string | null;
  position: number;
};

// Trending sorts posts and lists together by score, then by rank within their
// own kind. A pin gets a score between its neighbours', so it lands at its
// place among everything, posts and lists together. Where the neighbours'
// scores are equal it can only land on one side of the tie.
export function pinPosts(
  logs: RankedRow[],
  lists: RankedRow[],
  pins: TrendingPin[],
): { logs: RankedRow[]; lists: RankedRow[] } {
  if (pins.length === 0) return { logs, lists };
  const pinned = new Set(pins.map((p) => p.log_id ?? p.list_id));
  const restLogs = logs.filter((r) => !pinned.has(r.row_id));
  const restLists = lists.filter((r) => !pinned.has(r.row_id));
  const everything = [...restLogs, ...restLists]
    .map((r) => Number(r.recent_likes))
    .sort((a, b) => b - a);

  const placedLogs: RankedRow[] = [];
  const placedLists: RankedRow[] = [];
  // Earliest places first, so each pin counts the ones before it
  const ordered = [...pins].sort((a, b) => a.position - b.position);
  for (const pin of ordered) {
    const index = Math.min(pin.position - 1, everything.length);
    const above = index > 0 ? everything[index - 1] : undefined;
    const below = everything[index];
    let score: number;
    if (below === undefined) score = (above ?? 1) - 0.5;
    else if (above === undefined) score = below + 1;
    else score = (above + below) / 2;
    everything.splice(index, 0, score);
    if (pin.log_id)
      placedLogs.push({ row_id: pin.log_id, recent_likes: score });
    else if (pin.list_id)
      placedLists.push({ row_id: pin.list_id, recent_likes: score });
  }
  return {
    logs: [...placedLogs, ...restLogs],
    lists: [...placedLists, ...restLists],
  };
}
