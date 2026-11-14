// ABOUTME: Loads a person's diary a page at a time: their logs, lists, replies and compounds together, newest first.
// ABOUTME: Kept apart from the diary page so the server action for later pages can use it too.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card, CardsPage } from "@/components/CardPages";
import DiaryCraftCard from "@/components/DiaryCraftCard";
import DiaryListCard from "@/components/DiaryListCard";
import DiaryLogCard from "@/components/DiaryLogCard";
import DiaryReplyCard from "@/components/DiaryReplyCard";
import { FEATURES } from "@/lib/features";
import { timeAgo } from "@/lib/format";
import { isCompoundId } from "@/lib/ids";
import {
  type Keyset,
  olderThan,
  PAGE_SIZE,
  parseKeyset,
  takeNewest,
} from "@/lib/paging";
import { aboutAdultItem, parseSfwMode, shownEntries } from "@/lib/sfw";

// Where each kind of entry got to: the last of each shown so far
export type DiaryCursor = {
  logs?: Keyset;
  lists?: Keyset;
  replies?: Keyset;
  listReplies?: Keyset;
  crafts?: Keyset;
};

// How many pictures each list shows
const PREVIEW_SIZE = 4;

type ItemInfo = {
  title: string;
  image_url: string | null;
  nsfw: boolean;
} | null;

type LogRow = {
  id: string;
  item_id: string;
  rating: number | null;
  review: string;
  logged_at: string;
  items: ItemInfo;
  profiles: {
    username: string;
    user_settings: { sfw_mode: string } | null;
  } | null;
};

type ListRow = {
  id: string;
  title: string;
  ranked: boolean;
  created_at: string;
  list_items: { count: number }[];
  preview: { items: ItemInfo }[];
};

// A reply to a comment on a review
type ReplyRow = {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  logs: {
    id: string;
    items: ItemInfo;
    profiles: { username: string } | null;
  } | null;
};

// A reply to a comment on a list
type ListReplyRow = {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  lists: {
    id: string;
    title: string;
    profiles: { username: string } | null;
  } | null;
};

// A compound they crafted, with the names of what it is made from
type CraftRow = {
  id: string;
  at: string;
  title: string;
  description: string;
  imageUrl: string | null;
  parts: string[];
};

type Entry = Keyset & { card: Card; shown: boolean };

// A cursor that came from the browser, or null if it isn't one
export function parseDiaryCursor(value: unknown): DiaryCursor | null {
  if (typeof value !== "object" || value === null) return null;
  const { logs, lists, replies, listReplies, crafts } = value as Record<
    string,
    unknown
  >;
  const logsAt = parseKeyset(logs);
  const listsAt = parseKeyset(lists);
  const repliesAt = parseKeyset(replies);
  const listRepliesAt = parseKeyset(listReplies);
  const craftsAt = parseKeyset(crafts, isCompoundId);
  if (
    logsAt === false ||
    listsAt === false ||
    repliesAt === false ||
    listRepliesAt === false ||
    craftsAt === false
  ) {
    return null;
  }
  return {
    logs: logsAt,
    lists: listsAt,
    replies: repliesAt,
    listReplies: listRepliesAt,
    crafts: craftsAt,
  };
}

// Who wrote each of these comments, by comment id
async function authorsOf(
  supabase: SupabaseClient,
  table: "comments" | "list_comments",
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase
    .from(table)
    .select(`id, profiles!${table}_user_id_profiles_fkey(username)`)
    .in("id", ids);
  return new Map(
    (
      (data ?? []) as unknown as {
        id: string;
        profiles: { username: string } | null;
      }[]
    ).flatMap((c) =>
      c.profiles ? [[c.id, c.profiles.username] as const] : [],
    ),
  );
}

// The page of compounds `userId` crafted after `after`, with what each is made
// from. Left out while crafting is off, as their pages don't exist then.
async function craftsOf(
  supabase: SupabaseClient,
  userId: string,
  after: Keyset | undefined,
): Promise<{ rows: CraftRow[]; error: { message: string } | null }> {
  if (!FEATURES.compounds) return { rows: [], error: null };

  let query = supabase
    .from("compounds")
    .select("item_id, created_at")
    .eq("creator_id", userId);
  if (after) query = query.or(olderThan("created_at", after, "item_id"));
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("item_id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (error) return { rows: [], error };
  const compounds = (data ?? []) as { item_id: string; created_at: string }[];
  if (compounds.length === 0) return { rows: [], error: null };

  const ids = compounds.map((c) => c.item_id);
  const { data: partData, error: partsError } = await supabase
    .from("compound_parts")
    .select("compound_id, part_id, position")
    .in("compound_id", ids)
    .order("position");
  if (partsError) return { rows: [], error: partsError };
  const parts = (partData ?? []) as {
    compound_id: string;
    part_id: string;
  }[];

  const { data: itemData, error: itemsError } = await supabase
    .from("items")
    .select("id, title, description, image_url")
    .in("id", [...new Set([...ids, ...parts.map((p) => p.part_id)])]);
  if (itemsError) return { rows: [], error: itemsError };
  const items = new Map(
    (
      (itemData ?? []) as {
        id: string;
        title: string;
        description: string | null;
        image_url: string | null;
      }[]
    ).map((i) => [i.id, i]),
  );

  return {
    rows: compounds.map((c) => ({
      id: c.item_id,
      at: c.created_at,
      title: items.get(c.item_id)?.title ?? "Unknown compound",
      description: items.get(c.item_id)?.description ?? "",
      imageUrl: items.get(c.item_id)?.image_url ?? null,
      parts: parts
        .filter((p) => p.compound_id === c.item_id)
        .flatMap((p) => items.get(p.part_id)?.title ?? []),
    })),
    error: null,
  };
}

// The page of `userId`'s diary after `after`. Each page takes up to
// PAGE_SIZE + 1 more of each kind of entry from where each got to, so the
// newest PAGE_SIZE of them together are always among them.
export async function loadDiaryPage(
  supabase: SupabaseClient,
  userId: string,
  after: DiaryCursor,
): Promise<CardsPage<DiaryCursor>> {
  let logsQuery = supabase
    .from("logs")
    .select(
      "id, item_id, rating, review, logged_at, items(title, image_url, nsfw), profiles!logs_user_id_profiles_fkey(username, user_settings(sfw_mode))",
    )
    .eq("user_id", userId);
  if (after.logs) {
    logsQuery = logsQuery.or(olderThan("logged_at", after.logs));
  }
  let listsQuery = supabase
    .from("lists")
    .select(
      "id, title, ranked, created_at, list_items(count), preview:list_items(items(title, image_url, nsfw))",
    )
    .eq("user_id", userId);
  if (after.lists) {
    listsQuery = listsQuery.or(olderThan("created_at", after.lists));
  }
  let repliesQuery = supabase
    .from("comments")
    .select(
      "id, parent_id, body, created_at, logs!comments_log_fkey(id, items(title, nsfw), profiles!logs_user_id_profiles_fkey(username))",
    )
    .eq("user_id", userId)
    .is("removed_at", null);
  if (after.replies) {
    repliesQuery = repliesQuery.or(olderThan("created_at", after.replies));
  }
  let listRepliesQuery = supabase
    .from("list_comments")
    .select(
      "id, parent_id, body, created_at, lists(id, title, profiles!lists_user_id_profiles_fkey(username))",
    )
    .eq("user_id", userId)
    .is("removed_at", null);
  if (after.listReplies) {
    listRepliesQuery = listRepliesQuery.or(
      olderThan("created_at", after.listReplies),
    );
  }
  const [logsRes, listsRes, repliesRes, listRepliesRes, craftsRes] =
    await Promise.all([
      logsQuery
        .order("logged_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE + 1),
      listsQuery
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .order("position", { referencedTable: "preview" })
        .limit(PREVIEW_SIZE, { referencedTable: "preview" })
        .limit(PAGE_SIZE + 1),
      repliesQuery
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE + 1),
      listRepliesQuery
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE + 1),
      craftsOf(supabase, userId, after.crafts),
    ]);
  const error =
    logsRes.error ??
    listsRes.error ??
    repliesRes.error ??
    listRepliesRes.error ??
    craftsRes.error;
  if (error) return { cards: [], next: null, error: error.message };

  const replyRows = repliesRes.data as unknown as ReplyRow[];
  const listReplyRows = listRepliesRes.data as unknown as ListReplyRow[];
  const [replyAuthors, listReplyAuthors] = await Promise.all([
    authorsOf(
      supabase,
      "comments",
      replyRows.flatMap((r) => (r.parent_id ? [r.parent_id] : [])),
    ),
    authorsOf(
      supabase,
      "list_comments",
      listReplyRows.flatMap((r) => (r.parent_id ? [r.parent_id] : [])),
    ),
  ]);

  const now = Date.now();
  const logRows = logsRes.data as unknown as LogRow[];
  // Every log here is the viewer's own, so its owner's settings are the
  // viewer's. With no logs there is nothing to hide.
  const sfwMode = parseSfwMode(logRows[0]?.profiles?.user_settings?.sfw_mode);
  // Reviews of adult items are left out when the viewer hides them. They still
  // count towards the page, so a run of them doesn't end the diary early.
  const shownLogs = new Set(shownEntries(logRows, sfwMode, aboutAdultItem));
  const logs: Entry[] = logRows.map((l) => ({
    at: l.logged_at,
    id: l.id,
    shown: shownLogs.has(l),
    card: {
      key: `log:${l.id}`,
      card: (
        <DiaryLogCard
          logId={l.id}
          itemId={l.item_id}
          title={l.items?.title ?? "Unknown item"}
          imageUrl={l.items?.image_url ?? null}
          nsfw={l.items?.nsfw ?? false}
          rating={l.rating === null ? null : Number(l.rating)}
          review={l.review}
          ago={timeAgo(l.logged_at, now)}
          entryHref={
            l.profiles
              ? `/u/${encodeURIComponent(l.profiles.username)}/${l.id}`
              : null
          }
        />
      ),
    },
  }));
  const lists: Entry[] = (listsRes.data as unknown as ListRow[]).map((l) => ({
    at: l.created_at,
    id: l.id,
    shown: true,
    card: {
      key: `list:${l.id}`,
      card: (
        <DiaryListCard
          listId={l.id}
          title={l.title}
          ranked={l.ranked}
          count={l.list_items?.[0]?.count ?? 0}
          previews={l.preview.map((p) => ({
            title: p.items?.title ?? "Unknown item",
            imageUrl: p.items?.image_url ?? null,
            nsfw: p.items?.nsfw ?? false,
          }))}
          ago={timeAgo(l.created_at, now)}
        />
      ),
    },
  }));

  // Replies on something that is gone, or that its owner can't be told, are
  // left out; like the adult ones they still count towards the page
  const replies: Entry[] = replyRows.map((r) => ({
    at: r.created_at,
    id: r.id,
    shown:
      r.logs !== null &&
      r.logs.profiles !== null &&
      !(sfwMode === "hide" && aboutAdultItem(r.logs)),
    card: {
      key: `reply:${r.id}`,
      card: (
        <DiaryReplyCard
          replyId={r.id}
          kind="comment"
          cardKey={`reply:${r.id}`}
          ago={timeAgo(r.created_at, now)}
          href={
            r.logs?.profiles
              ? `/u/${encodeURIComponent(r.logs.profiles.username)}/${r.logs.id}`
              : "/"
          }
          isReply={r.parent_id !== null}
          replyingTo={
            r.parent_id ? (replyAuthors.get(r.parent_id) ?? null) : null
          }
          where={`${r.logs?.profiles?.username ?? "Someone"}'s review of ${r.logs?.items?.title ?? "an item"}`}
          body={r.body}
        />
      ),
    },
  }));
  const listReplies: Entry[] = listReplyRows.map((r) => ({
    at: r.created_at,
    id: r.id,
    shown: r.lists !== null,
    card: {
      key: `list-reply:${r.id}`,
      card: (
        <DiaryReplyCard
          replyId={r.id}
          kind="list_comment"
          cardKey={`list-reply:${r.id}`}
          ago={timeAgo(r.created_at, now)}
          href={r.lists ? `/list/${r.lists.id}` : "/"}
          isReply={r.parent_id !== null}
          replyingTo={
            r.parent_id ? (listReplyAuthors.get(r.parent_id) ?? null) : null
          }
          where={`${r.lists?.profiles?.username ?? "Someone"}'s list ${r.lists?.title ?? ""}`}
          body={r.body}
        />
      ),
    },
  }));

  const crafts: Entry[] = craftsRes.rows.map((c) => ({
    at: c.at,
    id: c.id,
    shown: true,
    card: {
      key: `craft:${c.id}`,
      card: (
        <DiaryCraftCard
          itemId={c.id}
          title={c.title}
          description={c.description}
          imageUrl={c.imageUrl}
          parts={c.parts}
          ago={timeAgo(c.at, now)}
        />
      ),
    },
  }));

  const {
    taken: [tookLogs, tookLists, tookReplies, tookListReplies, tookCrafts],
    hasMore,
  } = takeNewest([logs, lists, replies, listReplies, crafts], PAGE_SIZE);
  const lastOf = (took: Entry[], before?: Keyset): Keyset | undefined => {
    const last = took.at(-1);
    return last ? { at: last.at, id: last.id } : before;
  };
  return {
    cards: [
      ...tookLogs,
      ...tookLists,
      ...tookReplies,
      ...tookListReplies,
      ...tookCrafts,
    ]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .filter((e) => e.shown)
      .map((e) => e.card),
    next: hasMore
      ? {
          logs: lastOf(tookLogs, after.logs),
          lists: lastOf(tookLists, after.lists),
          replies: lastOf(tookReplies, after.replies),
          listReplies: lastOf(tookListReplies, after.listReplies),
          crafts: lastOf(tookCrafts, after.crafts),
        }
      : null,
    error: "",
  };
}