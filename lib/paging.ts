// ABOUTME: Helpers for loading lists a page at a time: page sizes, snapshots and cursors.
// ABOUTME: Cursors mark where each column of a feed got to, so the next page starts after it.
import { isUuid } from "@/lib/ids";

export const PAGE_SIZE = 30;

export function parseLimit(value: string | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return PAGE_SIZE;
  return Math.min(Math.max(Math.floor(n), PAGE_SIZE), 300);
}

// The moment a feed was first loaded. Later pages leave out anything newer, so
// new posts can't push down what someone is reading.
export function parseSnapshot(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? undefined : time.toISOString();
}

export function startOfMinute(time: string): string {
  const minute = new Date(time);
  minute.setUTCSeconds(0, 0);
  return minute.toISOString();
}

export function inIdOrder<Row extends { id: string }>(
  rows: Row[],
  ids: string[],
): Row[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

// The last row taken from a stream sorted newest first, by its time and then
// its id. The time is kept exactly as the database gave it.
export type Keyset = { at: string; id: string };

// Where one column of a feed got to. Time-ordered columns remember the last
// post and the last share they took. Trending remembers how far down its
// ranking it is.
export type ColumnCursor = { posts?: Keyset; shares?: Keyset; rank?: number };

// Each column is null once it has nothing more to show
export type FeedCursor = {
  reviews: ColumnCursor | null;
  lists: ColumnCursor | null;
};

export const FIRST_PAGE: FeedCursor = { reviews: {}, lists: {} };

// A filter for the rows after `position` when sorted by `column` and then id,
// both newest first
export function olderThan(column: string, position: Keyset): string {
  const at = `"${position.at}"`;
  return `${column}.lt.${at},and(${column}.eq.${at},id.lt.${position.id})`;
}

// Merges streams that are each sorted newest first and takes the newest
// `count` across all of them. Each stream must hold up to `count + 1` rows,
// so anything left over means there is more to load.
export function takeNewest<Row extends { at: string }>(
  streams: Row[][],
  count: number,
): { taken: Row[][]; hasMore: boolean } {
  const all = streams.flatMap((rows, stream) =>
    rows.map((row) => ({ row, stream })),
  );
  all.sort((a, b) => Date.parse(b.row.at) - Date.parse(a.row.at));
  const taken: Row[][] = streams.map(() => []);
  for (const { row, stream } of all.slice(0, count)) taken[stream].push(row);
  return { taken, hasMore: all.length > count };
}

function parseKeyset(value: unknown): Keyset | undefined | false {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null) return false;
  const { at, id } = value as Record<string, unknown>;
  if (typeof at !== "string" || typeof id !== "string") return false;
  // Only characters a timestamp can hold, so it is safe inside a filter
  if (!/^[0-9TZ:.+ -]+$/.test(at) || Number.isNaN(Date.parse(at))) {
    return false;
  }
  return isUuid(id) ? { at, id } : false;
}

function parseColumnCursor(value: unknown): ColumnCursor | null | false {
  if (value === null) return null;
  if (typeof value !== "object") return false;
  const { posts, shares, rank } = value as Record<string, unknown>;
  const cursor: ColumnCursor = {};
  const postsAt = parseKeyset(posts);
  const sharesAt = parseKeyset(shares);
  if (postsAt === false || sharesAt === false) return false;
  if (postsAt) cursor.posts = postsAt;
  if (sharesAt) cursor.shares = sharesAt;
  if (rank !== undefined) {
    if (typeof rank !== "number" || !Number.isInteger(rank) || rank < 0) {
      return false;
    }
    cursor.rank = rank;
  }
  return cursor;
}

// A cursor that came from the browser, or null if it isn't one
export function parseFeedCursor(value: unknown): FeedCursor | null {
  if (typeof value !== "object" || value === null) return null;
  const { reviews, lists } = value as Record<string, unknown>;
  const reviewsAt = parseColumnCursor(reviews);
  const listsAt = parseColumnCursor(lists);
  if (reviewsAt === false || listsAt === false) return null;
  return { reviews: reviewsAt, lists: listsAt };
}
