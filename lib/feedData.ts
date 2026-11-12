// ABOUTME: Loads the Everyone, Following and Trending feeds a page at a time.
// ABOUTME: Everyone and Trending are the same for every visitor, so they are cached remotely.
import type { SupabaseClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { shownImage } from "@/lib/format";
import {
  type ColumnCursor,
  type ColumnEnd,
  type FeedCursor,
  inIdOrder,
  type Keyset,
  olderThan,
  PAGE_SIZE,
  takeNewest,
} from "@/lib/paging";
import { TRENDING_HOURS } from "@/lib/site";
import { createPublicClient } from "@/lib/supabase/public";
import { POSTS_CACHE_TAG } from "./cacheTags";

export type LogRow = {
  id: string;
  user_id: string;
  item_id: string;
  rating: number | null;
  review: string;
  // Paths of its image in the post-images bucket
  images: string[];
  // When the automatic check passed its image, which is when its smaller
  // copies are made
  images_checked_at: string | null;
  logged_at: string;
  items: {
    title: string;
    image_url: string | null;
    image_hidden?: boolean;
  } | null;
  profiles: { username: string; avatar_path: string | null } | null;
  likes: { count: number }[];
  comments: { count: number }[];
  shares: { count: number }[];
};

export type ListRow = {
  id: string;
  user_id: string;
  title: string;
  ranked: boolean;
  created_at: string;
  profiles: { username: string; avatar_path: string | null } | null;
  list_items: { count: number }[];
  list_likes: { count: number }[];
  list_comments: { count: number }[];
  shares: { count: number }[];
};

export type Thumb = { title: string; image_url: string | null };

export type PublicFeed = {
  logs: LogRow[];
  lists: ListRow[];
  // Keyed by list id, the first few items of each list
  previews: Record<string, Thumb[]>;
  // Keyed by log or list id, the likes counted for Trending and the place in
  // its ranking (both empty otherwise)
  scores: Record<string, number>;
  ranks: Record<string, number>;
  // Following only: when the people followed shared these, newest first
  shares: ShareRow[];
  next: FeedCursor;
  // Where each column stopped, counting entries that were left out
  ends: { reviews: ColumnEnd; lists: ColumnEnd };
  error: string;
};

export type ShareRow = {
  user_id: string;
  log_id: string | null;
  list_id: string | null;
  created_at: string;
  profiles: { username: string } | null;
};

type PreviewRow = {
  list_id: string;
  position: number;
  items: (Thumb & { image_hidden: boolean }) | null;
};

type RankRow = { row_id: string; recent_likes: number | string };

const LOG_SELECT =
  "id, user_id, item_id, rating, review, images, images_checked_at, logged_at, items(title, image_url, image_hidden), profiles!logs_user_id_profiles_fkey(username, avatar_path), likes(count), comments(count), shares(count)";
export const LIST_SELECT =
  "id, user_id, title, ranked, created_at, profiles!lists_user_id_profiles_fkey(username, avatar_path), list_items(count), list_likes(count), list_comments(count), shares(count)";

// Empty lists stay out of the feed until they have something in them
function nonEmpty(lists: ListRow[]): ListRow[] {
  return lists.filter((l) => (l.list_items?.[0]?.count ?? 0) > 0);
}

// The first few items of each list that can be shown
async function loadPreviews(
  supabase: SupabaseClient,
  lists: ListRow[],
): Promise<Record<string, Thumb[]>> {
  const previews: Record<string, Thumb[]> = {};
  if (lists.length === 0) return previews;

  const { data } = await supabase
    .from("list_items")
    .select("list_id, position, items(title, image_url, image_hidden)")
    .in(
      "list_id",
      lists.map((l) => l.id),
    )
    .lte("position", 12)
    .order("position");
  for (const row of (data ?? []) as unknown as PreviewRow[]) {
    const arr = previews[row.list_id] ?? [];
    arr.push({
      title: row.items?.title ?? "Unknown item",
      image_url: row.items ? shownImage(row.items) : null,
    });
    previews[row.list_id] = arr;
  }
  return previews;
}

type Kind = "log" | "list";

const KINDS: Record<
  Kind,
  { table: string; select: string; time: string; share: string }
> = {
  log: {
    table: "logs",
    select: LOG_SELECT,
    time: "logged_at",
    share: "log_id",
  },
  list: {
    table: "lists",
    select: LIST_SELECT,
    time: "created_at",
    share: "list_id",
  },
};

// Something that puts a post in a column: the post itself, or a share of it
type ColumnEvent = { at: string; id: string; target: string };

type Column<Row> = {
  rows: Row[];
  next: ColumnCursor | null;
  end: ColumnEnd;
  error: string;
};

const NOTHING = { data: [], error: null };

// The rows of `table`, or with `following` only those by the viewer and the
// people they follow. That filter is done in the database (the following_*
// functions) rather than sent as a list of ids, which would make the request
// URL too long for anyone following a few hundred people.
function rowsOf(supabase: SupabaseClient, table: string, following: boolean) {
  return following ? supabase.rpc(`following_${table}`) : supabase.from(table);
}

// One page of a column in time order: the next posts made up to `asOf`. With
// `following`, only posts by the viewer and the people they follow, merged
// with the posts those people shared, each at the time it was shared. The
// same post can come again on a later page if it was also posted or shared
// earlier.
async function loadColumn<Row extends { id: string }>(
  supabase: SupabaseClient,
  kind: Kind,
  asOf: string,
  cursor: ColumnCursor | null,
  following = false,
): Promise<Column<Row>> {
  if (!cursor) return { rows: [], next: null, end: null, error: "" };
  const { table, select, time, share } = KINDS[kind];

  let posts = rowsOf(supabase, table, following).select(select).lte(time, asOf);
  if (cursor.posts) posts = posts.or(olderThan(time, cursor.posts));

  let shares = rowsOf(supabase, "shares", following)
    .select(`id, created_at, ${share}`)
    .not(share, "is", null)
    .lte("created_at", asOf);
  if (cursor.shares) shares = shares.or(olderThan("created_at", cursor.shares));

  const [postsRes, sharesRes] = await Promise.all([
    posts
      .order(time, { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE_SIZE + 1),
    following
      ? shares
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(PAGE_SIZE + 1)
      : NOTHING,
  ]);

  const postRows = (postsRes.data ?? []) as unknown as (Row &
    Record<string, string>)[];
  const shareRows = (sharesRes.data ?? []) as unknown as Record<
    string,
    string
  >[];
  const {
    taken: [tookPosts, tookShares],
    hasMore,
  } = takeNewest<ColumnEvent>(
    [
      postRows.map((r) => ({ at: r[time], id: r.id, target: r.id })),
      shareRows.map((s) => ({ at: s.created_at, id: s.id, target: s[share] })),
    ],
    PAGE_SIZE,
  );

  const lastOf = (events: ColumnEvent[], before?: Keyset) => {
    const last = events.at(-1);
    return last ? { at: last.at, id: last.id } : before;
  };
  const next = hasMore
    ? {
        posts: lastOf(tookPosts, cursor.posts),
        shares: lastOf(tookShares, cursor.shares),
      }
    : null;
  // Everything after this page is older than the oldest thing taken
  const taken = [tookPosts.at(-1), tookShares.at(-1)].flatMap((e) =>
    e ? [Date.parse(e.at)] : [],
  );
  const end = hasMore ? { score: 0, rank: 0, time: Math.min(...taken) } : null;

  // Shared posts that didn't come with the posts above
  const have = new Set(tookPosts.map((e) => e.id));
  const missing = [
    ...new Set(tookShares.map((e) => e.target).filter((id) => !have.has(id))),
  ];
  const extraRes =
    missing.length > 0
      ? await supabase.from(table).select(select).in("id", missing)
      : NOTHING;

  const rows = [
    ...postRows.filter((r) => have.has(r.id)),
    ...((extraRes.data ?? []) as unknown as Row[]),
  ];
  const error =
    postsRes.error?.message ??
    sharesRes.error?.message ??
    extraRes.error?.message ??
    "";
  return { rows, next, end, error };
}

// Puts the two columns of a page together, with the previews of its lists
async function assemble(
  supabase: SupabaseClient,
  logs: Column<LogRow>,
  lists: Column<ListRow>,
  scores: Record<string, number> = {},
  ranks: Record<string, number> = {},
): Promise<PublicFeed> {
  const shownLists = nonEmpty(lists.rows);
  return {
    logs: logs.rows.map((l) => ({
      ...l,
      items: l.items && { ...l.items, image_url: shownImage(l.items) },
    })),
    lists: shownLists,
    previews: await loadPreviews(supabase, shownLists),
    scores,
    ranks,
    shares: [],
    next: { reviews: logs.next, lists: lists.next },
    ends: { reviews: logs.end, lists: lists.end },
    error: logs.error || lists.error,
  };
}

// A page of the Everyone feed as it stood at `asOf`: the same for every
// visitor, so it is computed once a minute and shared. Each viewer's own
// hearts are looked up separately. Passing the start of a minute lets
// visitors share the result.
export async function getPublicFeed(
  asOf: string,
  cursor: FeedCursor,
): Promise<PublicFeed> {
  "use cache: remote";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  cacheTag(POSTS_CACHE_TAG);

  const supabase = createPublicClient();
  const [logs, lists] = await Promise.all([
    loadColumn<LogRow>(supabase, "log", asOf, cursor.reviews),
    loadColumn<ListRow>(supabase, "list", asOf, cursor.lists),
  ]);
  return assemble(supabase, logs, lists);
}

// A page of the Following feed: what the signed-in viewer and the people
// they follow posted or shared up to `asOf`. Comes with every share of these
// posts by those people, so each post can say who shared it and count from
// when it was last shared.
export async function getFollowingFeed(
  supabase: SupabaseClient,
  asOf: string,
  cursor: FeedCursor,
): Promise<PublicFeed> {
  const [logs, lists] = await Promise.all([
    loadColumn<LogRow>(supabase, "log", asOf, cursor.reviews, true),
    loadColumn<ListRow>(supabase, "list", asOf, cursor.lists, true),
  ]);
  const feed = await assemble(supabase, logs, lists);

  const targets = [
    ...(feed.logs.length > 0
      ? [`log_id.in.(${feed.logs.map((l) => l.id).join(",")})`]
      : []),
    ...(feed.lists.length > 0
      ? [`list_id.in.(${feed.lists.map((l) => l.id).join(",")})`]
      : []),
  ];
  if (targets.length === 0) return feed;

  // `targets` names only this page's posts (a few dozen ids), so it stays short
  const { data, error } = await rowsOf(supabase, "shares", true)
    .select("user_id, log_id, list_id, created_at, profiles(username)")
    .lte("created_at", asOf)
    .or(targets.join(","))
    .order("created_at", { ascending: false });
  return {
    ...feed,
    shares: (data ?? []) as unknown as ShareRow[],
    error: feed.error || (error?.message ?? ""),
  };
}

// How far down Trending goes
const TRENDING_DEPTH = 300;

// What was liked most in the last TRENDING_HOURS hours, most likes first and
// most recently liked first when they are tied. It is worked out once for each
// snapshot minute and then kept as it is, so paging further down it never
// repeats or skips anything. The minute only picks which ranking to use.
async function getTrendingRanking(_snapshotMinute: string) {
  "use cache: remote";
  cacheLife({ stale: 60, revalidate: 3600, expire: 3600 });
  cacheTag(POSTS_CACHE_TAG);

  const supabase = createPublicClient();
  const [logRank, listRank] = await Promise.all([
    supabase.rpc("trending_logs", {
      p_hours: TRENDING_HOURS,
      p_limit: TRENDING_DEPTH,
    }),
    supabase.rpc("trending_lists", {
      p_hours: TRENDING_HOURS,
      p_limit: TRENDING_DEPTH,
    }),
  ]);
  return {
    logs: (logRank.data ?? []) as RankRow[],
    lists: (listRank.data ?? []) as RankRow[],
    error: logRank.error?.message ?? listRank.error?.message ?? "",
  };
}

// A page of the Trending feed: the next PAGE_SIZE of each kind in the ranking
// for `snapshotMinute`. Also the same for every visitor, so also cached.
export async function getTrendingFeed(
  snapshotMinute: string,
  cursor: FeedCursor,
): Promise<PublicFeed> {
  "use cache: remote";
  cacheLife({ stale: 30, revalidate: 60, expire: 300 });
  cacheTag(POSTS_CACHE_TAG);

  const supabase = createPublicClient();
  const ranking = await getTrendingRanking(snapshotMinute);
  const scores: Record<string, number> = {};
  const ranks: Record<string, number> = {};

  async function rankedColumn<Row extends { id: string }>(
    kind: Kind,
    ranked: RankRow[],
    cursor: ColumnCursor | null,
  ): Promise<Column<Row>> {
    if (!cursor) return { rows: [], next: null, end: null, error: "" };
    const from = cursor.rank ?? 0;
    const to = from + PAGE_SIZE;
    const ids = ranked.slice(from, to).map((r) => r.row_id);
    ranked.slice(from, to).forEach((r, i) => {
      scores[r.row_id] = Number(r.recent_likes);
      ranks[r.row_id] = from + i;
    });
    const more = ranked.length > to;
    const next = more ? { rank: to } : null;
    const end = more
      ? { score: Number(ranked[to - 1].recent_likes), rank: to - 1, time: 0 }
      : null;
    if (ids.length === 0) return { rows: [], next, end, error: "" };

    const { table, select } = KINDS[kind];
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .in("id", ids);
    // The ranking's own order
    const rows = inIdOrder((data ?? []) as unknown as Row[], ids);
    return { rows, next, end, error: error?.message ?? "" };
  }

  const [logs, lists] = await Promise.all([
    rankedColumn<LogRow>("log", ranking.logs, cursor.reviews),
    rankedColumn<ListRow>("list", ranking.lists, cursor.lists),
  ]);
  const feed = await assemble(supabase, logs, lists, scores, ranks);
  return { ...feed, error: ranking.error || feed.error };
}
