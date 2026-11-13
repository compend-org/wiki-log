// ABOUTME: Loads a person's diary a page at a time: their logs and lists together, newest first.
// ABOUTME: Kept apart from the diary page so the server action for later pages can use it too.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card, CardsPage } from "@/components/CardPages";
import DiaryListCard from "@/components/DiaryListCard";
import DiaryLogCard from "@/components/DiaryLogCard";
import { timeAgo } from "@/lib/format";
import {
  type Keyset,
  olderThan,
  PAGE_SIZE,
  parseKeyset,
  takeNewest,
} from "@/lib/paging";
import { aboutAdultItem, parseSfwMode, shownEntries } from "@/lib/sfw";

// Where the logs and the lists each got to: the last of each shown so far
export type DiaryCursor = { logs?: Keyset; lists?: Keyset };

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

type Entry = Keyset & { card: Card; shown: boolean };

// A cursor that came from the browser, or null if it isn't one
export function parseDiaryCursor(value: unknown): DiaryCursor | null {
  if (typeof value !== "object" || value === null) return null;
  const { logs, lists } = value as Record<string, unknown>;
  const logsAt = parseKeyset(logs);
  const listsAt = parseKeyset(lists);
  if (logsAt === false || listsAt === false) return null;
  return { logs: logsAt, lists: listsAt };
}

// The page of `userId`'s diary after `after`. Each page takes up to
// PAGE_SIZE + 1 more of the logs and of the lists from where each got to, so
// the newest PAGE_SIZE of the two together are always among them.
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
  const [logsRes, listsRes] = await Promise.all([
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
  ]);
  const error = logsRes.error ?? listsRes.error;
  if (error) return { cards: [], next: null, error: error.message };

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

  const {
    taken: [tookLogs, tookLists],
    hasMore,
  } = takeNewest([logs, lists], PAGE_SIZE);
  const lastOf = (took: Entry[], before?: Keyset): Keyset | undefined => {
    const last = took.at(-1);
    return last ? { at: last.at, id: last.id } : before;
  };
  return {
    cards: [...tookLogs, ...tookLists]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .filter((e) => e.shown)
      .map((e) => e.card),
    next: hasMore
      ? {
          logs: lastOf(tookLogs, after.logs),
          lists: lastOf(tookLists, after.lists),
        }
      : null,
    error: "",
  };
}
