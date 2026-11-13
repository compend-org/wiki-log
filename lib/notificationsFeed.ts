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
  nsfw: boolean;
};

// A notification with the review or list it is about, and whether each person
// named on its card is an admin
type FeedQueryRow = NotificationRow & {
  profiles:
    | (NotificationRow["profiles"] & { admins: { user_id: string } | null })
    | null;
  logs: {
    user_id: string;
    item_id: string;
    items: ItemRow | null;
    owner: { username: string; admins: { user_id: string } | null } | null;
  } | null;
  lists: {
    title: string;
    list_items: { items: ItemRow | null }[];
  } | null;
};

function toThumb(item: ItemRow): Thumb {
  return { title: item.title, image_url: shownImage(item), nsfw: item.nsfw };
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
  // One query brings each notification with the entry it refers to: a
  // review's item and owner, or a list's first items. The two people embeds
  // name their foreign keys, and the owner has its own name, so they can't be
  // mistaken for each other.
  const { data, error } = await createClient()
    .from("notifications")
    .select(
      "id, type, read, created_at, log_id, list_id, comment_id, list_comment_id, actor_id, body, profiles!notifications_actor_fkey(username, avatar_path, admins(user_id)), logs!notifications_log_fkey(user_id, item_id, items!logs_item_id_fkey(title, image_url, image_hidden, nsfw), owner:profiles!logs_user_id_profiles_fkey(username, admins(user_id))), lists!notifications_list_id_fkey(title, list_items(position, items(title, image_url, image_hidden, nsfw)))",
    )
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .order("position", { referencedTable: "lists.list_items" })
    .limit(MOSAIC_SIZE, { referencedTable: "lists.list_items" })
    .limit(50);
  if (error) return { error: error.message };

  const list = (data ?? []) as unknown as FeedQueryRow[];
  const logs: Record<string, LogInfo> = {};
  const items: Record<string, Thumb> = {};
  const lists: Record<string, ListInfo> = {};
  const owners: Record<string, string> = {};
  // Everyone named on a card who is an admin. Notices from the moderators
  // have no actor.
  const adminIds = new Set<string>();
  for (const n of list) {
    if (n.actor_id && n.profiles?.admins) adminIds.add(n.actor_id);
    if (n.log_id && n.logs) {
      const { user_id, item_id, items: item, owner } = n.logs;
      logs[n.log_id] = { owner: user_id, item: item_id };
      if (item) items[item_id] = toThumb(item);
      if (owner) {
        owners[user_id] = owner.username;
        if (owner.admins) adminIds.add(user_id);
      }
    }
    if (n.list_id && n.lists) {
      lists[n.list_id] = {
        title: n.lists.title,
        items: n.lists.list_items.flatMap((e) =>
          e.items ? [toThumb(e.items)] : [],
        ),
      };
    }
  }

  return {
    feed: {
      rows: list,
      logs,
      items,
      lists,
      owners,
      adminIds,
      myId: userId,
      loadedAt: Date.now(),
    },
  };
}
