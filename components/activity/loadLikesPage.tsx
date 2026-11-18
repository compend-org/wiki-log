// ABOUTME: Loads the reviews and lists a person has liked a page at a time, most recently liked first.
// ABOUTME: Kept apart from the activity page so the server action for later pages can use it too.
import type { SupabaseClient } from "@supabase/supabase-js";
import DiaryListCard from "@/components/activity/DiaryListCard";
import DiaryLogCard from "@/components/activity/DiaryLogCard";
import type { Card, CardsPage } from "@/components/paging/CardPages";
import type { ActivityView } from "@/lib/activityView";
import { loadMessage } from "@/lib/errors/userFacingErrorMessage";
import { entryPicture, timeAgo } from "@/lib/format";
import { fetchManyGroupPreviews } from "@/lib/lists/groupPreview";
import { shownGroups } from "@/lib/lists/listGroups";
import {
  type Keyset,
  olderThan,
  PAGE_SIZE,
  parseKeyset,
  takeNewest,
} from "@/lib/paging";
import { aboutAdultItem, shownEntries } from "@/lib/sfw";
import { getViewerState } from "@/lib/viewerState";

// Where each kind of liked post got to: the last of each shown so far. Each is
// when it was liked, and the id of the review or list.
export type LikesCursor = {
  logs?: Keyset;
  lists?: Keyset;
};

// How many pictures each list shows
const PREVIEW_SIZE = 12;

type ItemInfo = {
  title: string;
  image_url: string | null;
  nsfw: boolean;
} | null;

type LikedLog = {
  created_at: string;
  log_id: string;
  logs: {
    id: string;
    user_id: string;
    item_id: string;
    rating: number | null;
    review: string;
    // The picture its author chose; null shows the item's
    image_url: string | null;
    items: ItemInfo;
    profiles: { username: string } | null;
  };
};

type LikedList = {
  created_at: string;
  list_id: string;
  lists: {
    id: string;
    user_id: string;
    title: string;
    ranked: boolean;
    list_items: { count: number }[];
    grouped: boolean;
    list_groups: { count: number }[];
    of_reviews: boolean;
    // Each entry's chosen picture; null shows the item's
    preview: { image_url: string | null; items: ItemInfo }[];
    profiles: { username: string } | null;
  };
};

type Entry = Keyset & { card: Card; shown: boolean };

// A cursor that came from the browser, or null if it isn't one
export function parseLikesCursor(value: unknown): LikesCursor | null {
  if (typeof value !== "object" || value === null) return null;
  const { logs, lists } = value as Record<string, unknown>;
  const logsAt = parseKeyset(logs);
  const listsAt = parseKeyset(lists);
  if (logsAt === false || listsAt === false) return null;
  return { logs: logsAt, lists: listsAt };
}

// The page of what `userId` has liked after `after`. Each page takes up to
// PAGE_SIZE + 1 more of each kind from where each got to, so the most recently
// liked PAGE_SIZE of them together are always among them.
export async function loadLikesPage(
  supabase: SupabaseClient,
  userId: string,
  after: LikesCursor,
  view?: ActivityView,
): Promise<CardsPage<LikesCursor>> {
  let logsQuery = supabase
    .from("likes")
    .select(
      "created_at, log_id, logs!inner(id, user_id, item_id, rating, review, image_url, items(title, image_url, nsfw), profiles!logs_user_id_profiles_fkey(username))",
    )
    .eq("user_id", userId);
  if (after.logs) {
    logsQuery = logsQuery.or(olderThan("created_at", after.logs, "log_id"));
  }
  let listsQuery = supabase
    .from("list_likes")
    .select(
      "created_at, list_id, lists!inner(id, user_id, title, ranked, list_items(count), grouped, list_groups(count), of_reviews, preview:list_items(image_url, items(title, image_url, nsfw)), profiles!lists_user_id_profiles_fkey(username))",
    )
    .eq("user_id", userId);
  if (after.lists) {
    listsQuery = listsQuery.or(olderThan("created_at", after.lists, "list_id"));
  }
  const [logsRes, listsRes] = await Promise.all([
    logsQuery
      .order("created_at", { ascending: false })
      .order("log_id", { ascending: false })
      .limit(PAGE_SIZE + 1),
    listsQuery
      .order("created_at", { ascending: false })
      .order("list_id", { ascending: false })
      .order("position", { referencedTable: "lists.preview" })
      .limit(PREVIEW_SIZE, { referencedTable: "lists.preview" })
      .limit(PAGE_SIZE + 1),
  ]);
  const error = logsRes.error ?? listsRes.error;
  if (error) return { cards: [], next: null, error: loadMessage(error) };

  const likedLogs = logsRes.data as unknown as LikedLog[];
  const likedLists = listsRes.data as unknown as LikedList[];
  // Who the viewer has blocked and how they want adult content shown. Both
  // are left out of what shows, but still count towards the page, so a run
  // of them doesn't end the list early.
  const { blocked, sfwMode } = await getViewerState(
    supabase,
    view ? view.viewerId : userId,
    {
      logIds: likedLogs.map((l) => l.log_id),
      listIds: likedLists.map((l) => l.list_id),
    },
  );
  const shownLogs = new Set(
    shownEntries(likedLogs, sfwMode, (l) => aboutAdultItem(l.logs)),
  );

  const now = Date.now();
  const logs: Entry[] = likedLogs.map((like) => {
    const l = like.logs;
    return {
      at: like.created_at,
      id: like.log_id,
      shown: shownLogs.has(like) && !blocked.has(l.user_id),
      card: {
        key: `liked-log:${like.log_id}`,
        card: (
          <DiaryLogCard
            logId={l.id}
            itemId={l.item_id}
            title={l.items?.title ?? "Unknown item"}
            imageUrl={entryPicture(l)}
            nsfw={l.items?.nsfw ?? false}
            rating={l.rating === null ? null : Number(l.rating)}
            review={l.review}
            ago={timeAgo(like.created_at, now)}
            entryHref={
              l.profiles
                ? `/u/${encodeURIComponent(l.profiles.username)}/${l.id}`
                : null
            }
            author={l.profiles?.username ?? "someone"}
            owner={view?.ownerName}
          />
        ),
      },
    };
  });
  // A grouped list's card shows several of its groups
  const groupPreviews = await fetchManyGroupPreviews(
    supabase,
    likedLists
      .filter((like) => shownGroups(like.lists) !== null)
      .map((like) => like.lists.id),
  );
  const lists: Entry[] = likedLists.map((like) => {
    const l = like.lists;
    return {
      at: like.created_at,
      id: like.list_id,
      shown: !blocked.has(l.user_id),
      card: {
        key: `liked-list:${like.list_id}`,
        card: (
          <DiaryListCard
            listId={l.id}
            title={l.title}
            ranked={l.ranked}
            groups={shownGroups(l)}
            groupPreviews={groupPreviews.get(l.id) ?? null}
            ofReviews={l.of_reviews}
            count={l.list_items?.[0]?.count ?? 0}
            previews={l.preview.map((p) => ({
              title: p.items?.title ?? "Unknown item",
              imageUrl: entryPicture(p),
              nsfw: p.items?.nsfw ?? false,
            }))}
            ago={timeAgo(like.created_at, now)}
            author={l.profiles?.username ?? "someone"}
            owner={view?.ownerName}
          />
        ),
      },
    };
  });

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
