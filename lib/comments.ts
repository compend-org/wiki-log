// ABOUTME: Loads the comments on a review or list as whole threads, newest threads first.
// ABOUTME: Shows the newest threads and how many older ones are left, past the API's row limit.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommentItem } from "@/components/Comments";
import { chunks, fetchRows } from "@/lib/allRows";

// Threads (a top-level comment and its replies) shown at first, and how many
// more each "Show earlier comments" adds
export const THREADS_PER_PAGE = 100;

// The most threads a page will show, however many are asked for
const MAX_THREADS = 10_000;

// Top-level comments asked about in one .in() filter, which goes in the URL
const PARENTS_PER_REQUEST = 100;

export type CommentTable = "comments" | "list_comments";

export type CommentRow = {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  user_id: string;
  // Only ever set on the viewer's own comments: other removed ones are hidden
  removed_at: string | null;
  profiles: { username: string } | null;
  likes: { count: number }[];
};

const SELECT: Record<CommentTable, string> = {
  comments:
    "id, parent_id, body, created_at, user_id, removed_at, profiles!comments_user_id_profiles_fkey(username), likes:comment_likes(count)",
  list_comments:
    "id, parent_id, body, created_at, user_id, removed_at, profiles!list_comments_user_id_profiles_fkey(username), likes:list_comment_likes(count)",
};

// What the comments hang off: a review for "comments", a list for
// "list_comments"
const SCOPE: Record<CommentTable, string> = {
  comments: "log_id",
  list_comments: "list_id",
};

// How many threads to show, from the URL: a multiple of THREADS_PER_PAGE, or
// THREADS_PER_PAGE when it isn't a number
export function parseThreads(value: string | string[] | undefined): number {
  const n = typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(n)) return THREADS_PER_PAGE;
  const pages = Math.max(1, Math.floor(n / THREADS_PER_PAGE));
  return Math.min(pages * THREADS_PER_PAGE, MAX_THREADS);
}

// The current page's address with `comments` set to show `threads` threads,
// keeping whatever else is in its query string
export function threadsHref(
  path: string,
  searchParams: Record<string, string | string[] | undefined>,
  threads: number,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "comments" || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value])
      query.append(key, v);
  }
  query.set("comments", String(threads));
  return `${path}?${query}`;
}

// Comments in the order they are shown: threads oldest first, then the
// replies oldest first. `top` is newest first, as it is loaded.
export function inThreadOrder<C extends { created_at: string; id: string }>(
  top: C[],
  replies: C[],
): C[] {
  const byTime = (a: C, b: C) =>
    a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
  return [...top].reverse().concat([...replies].sort(byTime));
}

// The newest `threads` threads on a review or list, with every reply to them,
// plus how many comments there are in all and how many older threads weren't
// loaded. A thread is loaded whole, so replies never lose their comment.
export async function fetchCommentThreads(
  supabase: SupabaseClient,
  table: CommentTable,
  targetId: string,
  threads: number,
): Promise<{
  rows: CommentRow[];
  total: number;
  olderThreads: number;
  error?: string;
}> {
  const scope = SCOPE[table];
  const [allCount, topCount, top] = await Promise.all([
    supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(scope, targetId),
    supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(scope, targetId)
      .is("parent_id", null),
    fetchRows<CommentRow>(
      (from, to) =>
        supabase
          .from(table)
          .select(SELECT[table])
          .eq(scope, targetId)
          .is("parent_id", null)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
      threads,
    ),
  ]);

  const replyBatches = await Promise.all(
    chunks(
      top.rows.map((c) => c.id),
      PARENTS_PER_REQUEST,
    ).map((parents) =>
      fetchRows<CommentRow>((from, to) =>
        supabase
          .from(table)
          .select(SELECT[table])
          .in("parent_id", parents)
          .order("created_at")
          .order("id")
          .range(from, to),
      ),
    ),
  );

  const error =
    allCount.error?.message ??
    topCount.error?.message ??
    top.error ??
    replyBatches.find((b) => b.error)?.error;
  return {
    rows: inThreadOrder(
      top.rows,
      replyBatches.flatMap((b) => b.rows),
    ),
    total: allCount.count ?? 0,
    olderThreads: Math.max(0, (topCount.count ?? 0) - top.rows.length),
    error,
  };
}

// The rows as the Comments component shows them
export function toCommentItems(
  rows: CommentRow[],
  adminIds: Set<string>,
  liked: Set<string>,
): CommentItem[] {
  return rows.map((c) => ({
    id: c.id,
    parentId: c.parent_id,
    body: c.body,
    date: c.created_at.slice(0, 10),
    authorId: c.user_id,
    authorName: c.profiles?.username ?? "Someone",
    authorIsAdmin: adminIds.has(c.user_id),
    removed: c.removed_at !== null,
    likeCount: c.likes?.[0]?.count ?? 0,
    liked: liked.has(c.id),
  }));
}
