// ABOUTME: Loads a person's lists or reviews for their profile a page at a time, rendered as cards.
// ABOUTME: Kept apart from the profile page so the server action for later pages can use it too.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import ListCard from "@/components/lists/ListCard";
import DeleteButton from "@/components/logs/DeleteButton";
import LogCard from "@/components/logs/LogCard";
import PinButton from "@/components/logs/PinButton";
import type { Card, CardsPage } from "@/components/paging/CardPages";
import { chunks } from "@/lib/allRows";
import { loadMessage } from "@/lib/errors/userFacingErrorMessage";
import type { ListRow as ListCardRow, LogRow } from "@/lib/feed/feedData";
import { entryPicture } from "@/lib/format";
import { type Keyset, olderThan } from "@/lib/paging";
import { aboutAdultItem, shownEntries } from "@/lib/sfw";
import { createClient } from "@/lib/supabase/server";
import { getViewerState, type ViewerState } from "@/lib/viewerState";

type ItemInfo = {
  title: string;
  image_url: string | null;
  nsfw: boolean;
} | null;

// The columns a review card needs, for both the review list and the pinned ones
const LOG_FIELDS =
  "id, user_id, item_id, rating, review, logged_at, image_url, items(title, image_url, nsfw), profiles!logs_user_id_profiles_fkey(username, avatar_path), likes(count), comments(count), shares(count)";

// The columns a list card needs, with the first items of the list as preview.
// Ask for `.lte("preview.position", 4)` with it.
const LIST_FIELDS =
  "id, user_id, title, ranked, created_at, profiles!lists_user_id_profiles_fkey(username, avatar_path), list_items(count), list_likes(count), list_comments(count), shares(count), last_bumped_at, activity_at, preview:list_items(position, image_url, items(title, image_url, nsfw))";

// How many pins, reviews or lists a profile shows at first, and how many more
// reviews or lists each "Show more" adds
export const PROFILE_PAGE_SIZE_INITIAL = 3;
const PROFILE_MORE_PAGE = 7;

export type ProfileListRow = ListCardRow & {
  // Each entry's chosen picture; null shows the item's
  preview: { position: number; image_url: string | null; items: ItemInfo }[];
};

export type ProfileKind = "lists" | "reviews";

// Logs or lists asked about in one .in() filter, which goes in the URL
const IDS_PER_REQUEST = 100;

// Who is looking at whose profile, and what that person has pinned
export type ProfileContext = {
  profileId: string;
  viewerId: string | undefined;
  pinnedLogIds: Set<string>;
  pinnedListIds: Set<string>;
  // The logs and lists the profile's Pinned section shows, which its Lists
  // and Reviews leave out
  pinnedOnTop: Set<string>;
};

// What one pin points at
export type PinTarget = { log_id: string | null; list_id: string | null };

export type Pinned =
  | { kind: "log"; log: LogRow }
  | { kind: "list"; list: ProfileListRow };

// What a person has pinned, from their pins in order
export function pinSets(
  pins: PinTarget[],
): Pick<ProfileContext, "pinnedLogIds" | "pinnedListIds" | "pinnedOnTop"> {
  return {
    pinnedLogIds: new Set(pins.flatMap((p) => p.log_id ?? [])),
    pinnedListIds: new Set(pins.flatMap((p) => p.list_id ?? [])),
    pinnedOnTop: new Set(
      pins
        .slice(0, PROFILE_PAGE_SIZE_INITIAL)
        .flatMap((p) => p.log_id ?? p.list_id ?? []),
    ),
  };
}

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

// Pin and Unpin, on your own profile
function pinControl(
  ctx: ProfileContext,
  kind: "log" | "list",
  id: string,
  isPinned: boolean,
): ReactNode {
  return ctx.viewerId && ctx.viewerId === ctx.profileId ? (
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

function renderProfileList(
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
        image_url: entryPicture(p),
        nsfw: p.items?.nsfw ?? false,
      }))}
      viewerId={ctx.viewerId}
      liked={viewer.likedLists.has(l.id)}
      shared={viewer.sharedLists.has(l.id)}
      showAuthor={false}
      // Profiles order lists by when they were made, so show that date
      showActivity={false}
      controls={pinControl(ctx, "list", l.id, isPinned)}
      topControls={deleteControl(ctx, "list", l.id)}
    />
  );
}

function renderProfileLog(
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

// The rows of one page, newest first, after `cursor`. The pinned ones the
// profile shows at the top are left out.
export async function fetchProfileRows(
  supabase: SupabaseClient,
  ctx: ProfileContext,
  kind: ProfileKind,
  cursor: Keyset | null,
  rating?: number,
  includePinned = false,
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

  const size = cursor ? PROFILE_MORE_PAGE : PROFILE_PAGE_SIZE_INITIAL;
  const { data, error } = await query.limit(size + 1);

  const all = (data ?? []) as unknown as (Record<string, unknown> & {
    id: string;
  })[];
  const page = all.slice(0, size);
  const last = page.at(-1);
  const next =
    all.length > size && last
      ? { at: last[time] as string, id: last.id }
      : null;
  const pinned =
    rating !== undefined || includePinned ? new Set<string>() : ctx.pinnedOnTop;
  return {
    rows: page.filter((r) => !pinned.has(r.id)) as unknown as (
      | ProfileListRow
      | LogRow
    )[],
    next,
    error: loadMessage(error),
  };
}

export function renderProfileCards(
  ctx: ProfileContext,
  viewer: ViewerState,
  kind: ProfileKind,
  rows: (ProfileListRow | LogRow)[],
): Card[] {
  // Reviews of adult items are left out when the viewer hides them
  const shown =
    kind === "lists"
      ? rows
      : shownEntries(rows as LogRow[], viewer.sfwMode, aboutAdultItem);
  // Pinned ones come up here too, apart from those the profile shows at the
  // top
  return shown.map((row) => ({
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
  includePinned = false,
): Promise<CardsPage> {
  const supabase = await createClient();
  const [{ data: claimsData }, { data: pins }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase
      .from("pins")
      .select("log_id, list_id")
      .eq("user_id", profileId)
      .order("position")
      .order("id"),
  ]);
  const ctx: ProfileContext = {
    profileId,
    viewerId: claimsData?.claims?.sub,
    ...pinSets((pins ?? []) as PinTarget[]),
  };

  const { rows, next, error } = await fetchProfileRows(
    supabase,
    ctx,
    kind,
    cursor,
    rating,
    includePinned,
  );
  const ids = rows.map((r) => r.id);
  const viewer = await getViewerState(
    supabase,
    ctx.viewerId,
    kind === "lists" ? { listIds: ids } : { logIds: ids },
  );
  return { cards: renderProfileCards(ctx, viewer, kind, rows), next, error };
}

// The logs and lists these pins point at, in the pins' order. A pin whose log
// or list can't be found is left out.
export async function fetchPinned(
  supabase: SupabaseClient,
  pins: PinTarget[],
): Promise<{ pinned: Pinned[]; error: string }> {
  const logIds = pins.flatMap((p) => p.log_id ?? []);
  const listIds = pins.flatMap((p) => p.list_id ?? []);
  const [logResponses, listResponses] = await Promise.all([
    Promise.all(
      chunks(logIds, IDS_PER_REQUEST).map((ids) =>
        supabase.from("logs").select(LOG_FIELDS).in("id", ids),
      ),
    ),
    Promise.all(
      chunks(listIds, IDS_PER_REQUEST).map((ids) =>
        supabase
          .from("lists")
          .select(LIST_FIELDS)
          .in("id", ids)
          .lte("preview.position", 4)
          .order("position", { referencedTable: "preview" }),
      ),
    ),
  ]);
  const logs = new Map(
    logResponses
      .flatMap((r) => (r.data ?? []) as unknown as LogRow[])
      .map((l) => [l.id, l]),
  );
  const lists = new Map(
    listResponses
      .flatMap((r) => (r.data ?? []) as unknown as ProfileListRow[])
      .map((l) => [l.id, l]),
  );
  const pinned = pins.flatMap((p): Pinned[] => {
    const log = p.log_id ? logs.get(p.log_id) : undefined;
    if (log) return [{ kind: "log", log }];
    const list = p.list_id ? lists.get(p.list_id) : undefined;
    return list ? [{ kind: "list", list }] : [];
  });
  return {
    pinned,
    error: loadMessage(
      [...logResponses, ...listResponses].find((r) => r.error)?.error,
    ),
  };
}

export function renderPinnedCards(
  ctx: ProfileContext,
  viewer: ViewerState,
  pinned: Pinned[],
): Card[] {
  // Pinned reviews of adult items are left out when the viewer hides them
  const shown = shownEntries(
    pinned,
    viewer.sfwMode,
    (p) => p.kind === "log" && aboutAdultItem(p.log),
  );
  return shown.map((p) =>
    p.kind === "log"
      ? { key: p.log.id, card: renderProfileLog(ctx, viewer, p.log, true) }
      : { key: p.list.id, card: renderProfileList(ctx, viewer, p.list, true) },
  );
}

// The last pin a page of pins took, by its place in the person's order and
// then its id
export type PinCursor = { position: number; id: string };

// A page of someone's pins, in their order, after `cursor`
export async function loadPinnedPage(
  profileId: string,
  cursor: PinCursor | null,
): Promise<CardsPage<PinCursor>> {
  const size = cursor ? PROFILE_MORE_PAGE : PROFILE_PAGE_SIZE_INITIAL;
  const supabase = await createClient();
  let query = supabase
    .from("pins")
    .select("id, position, log_id, list_id")
    .eq("user_id", profileId);
  if (cursor) {
    query = query.or(
      `position.gt.${cursor.position},and(position.eq.${cursor.position},id.gt.${cursor.id})`,
    );
  }
  const [{ data: claimsData }, { data, error }] = await Promise.all([
    supabase.auth.getClaims(),
    query
      .order("position")
      .order("id")
      .limit(size + 1),
  ]);
  const pins = (data ?? []) as (PinTarget & PinCursor)[];
  const page = pins.slice(0, size);
  const last = page.at(-1);
  const ctx: ProfileContext = {
    profileId,
    viewerId: claimsData?.claims?.sub,
    ...pinSets(page),
  };
  const { pinned, error: pinnedError } = await fetchPinned(supabase, page);
  const viewer = await getViewerState(supabase, ctx.viewerId, {
    logIds: pinned.flatMap((p) => (p.kind === "log" ? [p.log.id] : [])),
    listIds: pinned.flatMap((p) => (p.kind === "list" ? [p.list.id] : [])),
  });
  return {
    cards: renderPinnedCards(ctx, viewer, pinned),
    next:
      pins.length > size && last
        ? { position: last.position, id: last.id }
        : null,
    error: loadMessage(error) || pinnedError,
  };
}
