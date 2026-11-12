// ABOUTME: Loads a person's lists or reviews for their profile a page at a time, rendered as cards.
// ABOUTME: Kept apart from the profile page so the server action for later pages can use it too.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import PinButton from "@/components/buttons/PinButton";
import type { Card, CardsPage } from "@/components/CardPages";
import ListCard from "@/components/ListCard";
import LogCard from "@/components/LogCard";
import type { ListRow as ListCardRow, LogRow } from "@/lib/feedData";
import { type Keyset, olderThan, PAGE_SIZE } from "@/lib/paging";
import { createClient } from "@/lib/supabase/server";
import { getViewerState, type ViewerState } from "@/lib/viewerState";
import DeleteButton from "./buttons/DeleteButton";

type ItemInfo = { title: string; image_url: string | null } | null;

// The columns a review card needs, for both the review list and the pinned ones
export const LOG_FIELDS =
  "id, user_id, item_id, rating, review, logged_at, items(title, image_url), profiles!logs_user_id_profiles_fkey(username, avatar_path), likes(count), comments(count), shares(count)";

// The columns a list card needs, with the first items of the list as preview.
// Ask for `.lte("preview.position", 4)` with it.
export const LIST_FIELDS =
  "id, user_id, title, ranked, created_at, profiles!lists_user_id_profiles_fkey(username, avatar_path), list_items(count), list_likes(count), list_comments(count), shares(count), preview:list_items(position, items(title, image_url))";

export type ProfileListRow = ListCardRow & {
  preview: { position: number; items: ItemInfo }[];
};

// How many things a person can pin. The database enforces the same number.
const MAX_PINS = 3;

export type ProfileKind = "lists" | "reviews";

// Who is looking at whose profile, and what that person has pinned
export type ProfileContext = {
  profileId: string;
  viewerId: string | undefined;
  pinnedLogIds: Set<string>;
  pinnedListIds: Set<string>;
};

const KINDS: Record<
  ProfileKind,
  { table: string; select: string; time: string; owner: string }
> = {
  lists: {
    table: "lists",
    select: LIST_FIELDS,
    time: "created_at",
    owner: "user_id",
  },
  reviews: {
    table: "logs",
    select: LOG_FIELDS,
    time: "logged_at",
    owner: "user_id",
  },
};

// Pin and Unpin, on your own profile. Once you have 3 pins, only Unpin shows.
function pinControl(
  ctx: ProfileContext,
  kind: "log" | "list",
  id: string,
  isPinned: boolean,
): ReactNode {
  const pinCount = ctx.pinnedLogIds.size + ctx.pinnedListIds.size;
  return ctx.viewerId === ctx.profileId &&
    ctx.viewerId &&
    (isPinned || pinCount < MAX_PINS) ? (
    <PinButton
      userId={ctx.viewerId}
      kind={kind}
      targetId={id}
      pinned={isPinned}
    />
  ) : null;
}

function deleteControl(
  ctx: ProfileContext,
  kind: "log" | "list",
  id: string,
): ReactNode {
  return ctx.viewerId && ctx.viewerId === ctx.profileId ? (
    <DeleteButton kind={kind} targetId={id} />
  ) : null;
}

export function renderProfileList(
  ctx: ProfileContext,
  viewer: ViewerState,
  l: ProfileListRow,
  isPinned: boolean,
): ReactNode {
  return (
    <ListCard
      key={l.id}
      list={l}
      thumbs={l.preview.map((p) => ({
        title: p.items?.title ?? "Unknown item",
        image_url: p.items?.image_url ?? null,
      }))}
      viewerId={ctx.viewerId}
      liked={viewer.likedLists.has(l.id)}
      shared={viewer.sharedLists.has(l.id)}
      showAuthor={false}
      controls={pinControl(ctx, "list", l.id, isPinned)}
      topControls={deleteControl(ctx, "list", l.id)}
    />
  );
}

export function renderProfileLog(
  ctx: ProfileContext,
  viewer: ViewerState,
  log: LogRow,
  isPinned: boolean,
): ReactNode {
  return (
    <LogCard
      key={log.id}
      log={log}
      viewerId={ctx.viewerId}
      liked={viewer.likedLogs.has(log.id)}
      shared={viewer.sharedLogs.has(log.id)}
      showAuthor={false}
      controls={pinControl(ctx, "log", log.id, isPinned)}
      topControls={deleteControl(ctx, "log", log.id)}
    />
  );
}

// The rows of one page, newest first, after `cursor`. Pinned ones are left
// out, as they show at the top of the profile instead.
export async function fetchProfileRows(
  supabase: SupabaseClient,
  ctx: ProfileContext,
  kind: ProfileKind,
  cursor: Keyset | null,
  rating?: number,
): Promise<{
  rows: (ProfileListRow | LogRow)[];
  next: Keyset | null;
  error: string;
}> {
  const { table, select, time, owner } = KINDS[kind];
  let query = supabase.from(table).select(select).eq(owner, ctx.profileId);
  if (kind === "lists") query = query.lte("preview.position", 4);
  if (rating !== undefined) query = query.eq("rating", rating);
  if (cursor) query = query.or(olderThan(time, cursor));
  query = query
    .order(time, { ascending: false })
    .order("id", { ascending: false });
  if (kind === "lists") {
    query = query.order("position", { referencedTable: "preview" });
  }

  const { data, error } = await query.limit(PAGE_SIZE + 1);

  const all = (data ?? []) as unknown as (Record<string, unknown> & {
    id: string;
  })[];
  const page = all.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  const next =
    all.length > PAGE_SIZE && last
      ? { at: last[time] as string, id: last.id }
      : null;
  const pinned =
    rating !== undefined
      ? new Set<string>()
      : kind === "lists"
        ? ctx.pinnedListIds
        : ctx.pinnedLogIds;
  return {
    rows: page.filter((r) => !pinned.has(r.id)) as unknown as (
      | ProfileListRow
      | LogRow
    )[],
    next,
    error: error?.message ?? "",
  };
}

export function renderProfileCards(
  ctx: ProfileContext,
  viewer: ViewerState,
  kind: ProfileKind,
  rows: (ProfileListRow | LogRow)[],
): Card[] {
  // Pinned ones only come up here among reviews with one rating; the
  // profile itself shows them in their own section instead
  return rows.map((row) => ({
    key: row.id,
    card:
      kind === "lists"
        ? renderProfileList(
            ctx,
            viewer,
            row as ProfileListRow,
            ctx.pinnedListIds.has(row.id),
          )
        : renderProfileLog(
            ctx,
            viewer,
            row as LogRow,
            ctx.pinnedLogIds.has(row.id),
          ),
  }));
}

// A later page of someone's lists or reviews, for the server action
export async function loadProfilePage(
  profileId: string,
  kind: ProfileKind,
  cursor: Keyset | null,
  rating?: number,
): Promise<CardsPage> {
  const supabase = await createClient();
  const [{ data: claimsData }, { data: pins }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.from("pins").select("log_id, list_id").eq("user_id", profileId),
  ]);
  const pinRows = (pins ?? []) as {
    log_id: string | null;
    list_id: string | null;
  }[];
  const ctx: ProfileContext = {
    profileId,
    viewerId: claimsData?.claims?.sub,
    pinnedLogIds: new Set(pinRows.flatMap((p) => p.log_id ?? [])),
    pinnedListIds: new Set(pinRows.flatMap((p) => p.list_id ?? [])),
  };

  const { rows, next, error } = await fetchProfileRows(
    supabase,
    ctx,
    kind,
    cursor,
    rating,
  );
  const ids = rows.map((r) => r.id);
  const viewer = await getViewerState(
    supabase,
    ctx.viewerId,
    kind === "lists" ? { listIds: ids } : { logIds: ids },
  );
  return { cards: renderProfileCards(ctx, viewer, kind, rows), next, error };
}
