// ABOUTME: Fetches the signed-in person's latest notifications with what their cards show,
// ABOUTME: and keeps the last result in the browser so the notifications page opens with it.
import { MOSAIC_SIZE } from "@/components/NotificationThumb";
import type { Thumb } from "@/lib/feedData";
import { shownImage } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

export type NotificationRow = {
  id: string;
  type:
    | "like"
    | "comment"
    | "reply"
    | "follow"
    | "list_like"
    | "list_comment"
    | "list_reply"
    | "share"
    | "list_share"
    | "moderation"
    | "comment_like"
    | "list_comment_like"
    | "mention";
  read: boolean;
  created_at: string;
  log_id: string | null;
  list_id: string | null;
  // Set when the notice is about a comment, on a review or on a list
  comment_id: string | null;
  list_comment_id: string | null;
  // Moderators' messages have no actor, just a body
  actor_id: string | null;
  body: string | null;
  profiles: { username: string; avatar_path: string | null } | null;
};

type LogInfo = { owner: string; item: string };
type ListInfo = { title: string; items: Thumb[] };

type ItemRow = {
  title: string;
  image_url: string | null;
  image_hidden: boolean;
};

type ListQueryRow = {
  id: string;
  title: string;
  list_items: { items: ItemRow | null }[];
};

function toThumb(item: ItemRow): Thumb {
  return { title: item.title, image_url: shownImage(item) };
}

export type NotificationsFeed = {
  rows: NotificationRow[];
  logs: Record<string, LogInfo>;
  items: Record<string, Thumb>;
  lists: Record<string, ListInfo>;
  owners: Record<string, string>;
  adminIds: Set<string>;
  myId: string;
  // When the data arrived, which is what the times on the cards count from
  loadedAt: number;
};

type FeedResult = { feed: NotificationsFeed } | { error: string };

// The last feed fetched in this browser tab, and the fetch under way if any
let latest: NotificationsFeed | null = null;
let pending: { userId: string; result: Promise<FeedResult> } | null = null;

// The last feed fetched, to show while a fresh one loads
export function latestNotifications(): NotificationsFeed | null {
  return latest;
}

// Fetches the feed, sharing a fetch already under way for the same person
export function fetchNotifications(userId: string): Promise<FeedResult> {
  if (pending?.userId === userId) return pending.result;
  // A fetch dropped by keepNotificationsOnlyFor, or replaced by another,
  // leaves the kept feed alone
  const result = loadFeed(userId).then((outcome) => {
    if (pending?.result !== result) return outcome;
    pending = null;
    if ("feed" in outcome) latest = outcome.feed;
    return outcome;
  });
  pending = { userId, result };
  return result;
}

// Drops any feed that belongs to someone other than this person
export function keepNotificationsOnlyFor(userId: string | null) {
  if (latest && latest.myId !== userId) latest = null;
  if (pending && pending.userId !== userId) pending = null;
}

// Records that every notification in this feed has been read, if it is still
// the kept one
export function markNotificationsRead(feed: NotificationsFeed) {
  if (latest === feed) {
    latest = { ...feed, rows: feed.rows.map((n) => ({ ...n, read: true })) };
  }
}

async function loadFeed(userId: string): Promise<FeedResult> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, type, read, created_at, log_id, list_id, comment_id, list_comment_id, actor_id, body, profiles!notifications_actor_fkey(username, avatar_path)",
    )
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return { error: error.message };

  const list = (data ?? []) as unknown as NotificationRow[];
  // The entries these refer to, then their items and owners
  const logIds = [
    ...new Set(list.map((n) => n.log_id).filter((v): v is string => !!v)),
  ];
  const listIds = [
    ...new Set(list.map((n) => n.list_id).filter((v): v is string => !!v)),
  ];

  const logRes = logIds.length
    ? await supabase
        .from("logs")
        .select("id, user_id, item_id")
        .in("id", logIds)
    : { data: [] as { id: string; user_id: string; item_id: string }[] };
  const logRows = logRes.data ?? [];

  const itemIds = [...new Set(logRows.map((l) => l.item_id))];
  const ownerIds = [...new Set(logRows.map((l) => l.user_id))];

  // Everyone who could be named on a card, to badge the admins among them.
  // Notices from the moderators have no actor.
  const actorIds = list.flatMap((n) => (n.actor_id ? [n.actor_id] : []));
  const peopleIds = [...new Set([...actorIds, ...ownerIds])];

  const [itemRes, listRes, profs, admins] = await Promise.all([
    itemIds.length
      ? supabase
          .from("items")
          .select("id, title, image_url, image_hidden")
          .in("id", itemIds)
      : Promise.resolve({ data: [] as (ItemRow & { id: string })[] }),
    listIds.length
      ? supabase
          .from("lists")
          .select(
            "id, title, list_items(position, items(title, image_url, image_hidden))",
          )
          .in("id", listIds)
          .order("position", { referencedTable: "list_items" })
          .limit(MOSAIC_SIZE, { referencedTable: "list_items" })
      : Promise.resolve({ data: [] as ListQueryRow[] }),
    ownerIds.length
      ? supabase.from("profiles").select("id, username").in("id", ownerIds)
      : Promise.resolve({ data: [] as { id: string; username: string }[] }),
    peopleIds.length
      ? supabase.from("admins").select("user_id").in("user_id", peopleIds)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
  ]);

  return {
    feed: {
      rows: list,
      logs: Object.fromEntries(
        logRows.map((l) => [l.id, { owner: l.user_id, item: l.item_id }]),
      ),
      items: Object.fromEntries(
        (itemRes.data ?? []).map((v) => [v.id, toThumb(v)]),
      ),
      lists: Object.fromEntries(
        ((listRes.data ?? []) as unknown as ListQueryRow[]).map((v) => [
          v.id,
          {
            title: v.title,
            items: v.list_items.flatMap((e) =>
              e.items ? [toThumb(e.items)] : [],
            ),
          },
        ]),
      ),
      owners: Object.fromEntries(
        (profs.data ?? []).map((p) => [p.id, p.username]),
      ),
      adminIds: new Set((admins.data ?? []).map((a) => a.user_id)),
      myId: userId,
      loadedAt: Date.now(),
    },
  };
}
