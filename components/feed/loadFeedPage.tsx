// ABOUTME: Loads one page of a home page feed and renders its cards for the viewer.
// ABOUTME: Kept apart from Feed so server actions can use it without importing FeedPages.
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import DiaryReplyCard from "@/components/activity/DiaryReplyCard";
import { authorsOf } from "@/components/activity/loadDiaryPage";
import ListCard from "@/components/lists/ListCard";
import LogCard from "@/components/logs/LogCard";
import type { Sharer } from "@/components/logs/SharedLabel";
import { FEATURES } from "@/lib/features";
import {
  getFollowingFeed,
  getPublicFeed,
  getTrendingFeed,
  type ListReplyRow,
  type ListRow,
  type LogRow,
  type PublicFeed,
  type ReplyRow,
  type Thumb,
} from "@/lib/feed/feedData";
import { timeAgo } from "@/lib/format";
import { markHidden, withoutHiddenItems } from "@/lib/hiddenItems";
import {
  type ColumnEnd,
  type FeedCursor,
  type FeedOrder,
  startOfMinute,
} from "@/lib/paging";
import { aboutAdultItem, shownEntries } from "@/lib/sfw";
import { createClient } from "@/lib/supabase/server";
import { getViewerState } from "@/lib/viewerState";

export type FeedMode = "following" | "everyone" | "trending";

// The feeds a visitor can ask for
export const FEED_MODES: FeedMode[] = [
  "following",
  "everyone",
  ...(FEATURES.trending ? (["trending"] as const) : []),
];

// `sharers` are the people you follow (or you) who shared this entry, newest
// first. It is only filled in on the Following tab.
type Entry =
  | { kind: "log"; date: string; log: LogRow; sharers: Sharer[] }
  | { kind: "list"; date: string; list: ListRow; sharers: Sharer[] };

// A rendered card with where it sits in the feed
export type FeedCard = {
  key: string;
  order: FeedOrder;
  card: ReactNode;
};

export type FeedPage = {
  reviews: FeedCard[];
  lists: FeedCard[];
  next: FeedCursor;
  ends: { reviews: ColumnEnd; lists: ColumnEnd };
  error: string;
  needsSignIn: boolean;
  noFollows: boolean;
  // The signed-in viewer, and how many people they follow (Following only)
  viewerId: string | undefined;
  followedCount: number;
};

// One page of a feed as it stood at `asOf`, rendered for the viewer. Each of
// the two columns, reviews and lists, carries on from where `cursor` says.
export async function loadFeedPage(
  mode: FeedMode,
  asOf: string,
  cursor: FeedCursor,
): Promise<FeedPage> {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId: string | undefined = claimsData?.claims?.sub;

  // Following shows the people you follow and you, so your own entries are in
  // it as well. Who they are is worked out in the database; here we only need
  // to know whether you follow anyone.
  let followedCount = 0;
  if (mode === "following" && viewerId) {
    const { count } = await supabase
      .from("follows")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", viewerId);
    followedCount = count ?? 0;
  }

  let replies: ReplyRow[] = [];
  let listReplies: ListReplyRow[] = [];
  let replyToAuthors = new Map<string, string>();
  let reviewEntries: Entry[] = [];
  let listEntries: Entry[] = [];
  let next: FeedCursor = { reviews: null, lists: null };
  let ends: FeedPage["ends"] = { reviews: null, lists: null };
  let errorMessage = "";
  let likedSet = new Set<string>();
  let likedLists = new Set<string>();
  let sharedSet = new Set<string>();
  let sharedLists = new Set<string>();
  let hiddenItems = new Set<string>();
  // Following only: who shared each log or list id, and when most recently
  const sharedBy = new Map<string, { sharers: Sharer[]; latest: string }>();
  let scores: Record<string, number> = {};
  let ranks: Record<string, number> = {};
  const previews = new Map<string, Thumb[]>();

  if (mode !== "following" || viewerId) {
    // Everyone and Trending are the same for every visitor, so they are
    // cached and shared. Following is the viewer's own. The viewer's own
    // hearts are looked up below.
    const feed: PublicFeed =
      mode === "following"
        ? await getFollowingFeed(supabase, asOf, cursor)
        : mode === "trending"
          ? await getTrendingFeed(startOfMinute(asOf), cursor)
          : await getPublicFeed(startOfMinute(asOf), cursor);
    let logs = feed.logs;
    let lists = feed.lists;
    scores = feed.scores;
    ranks = feed.ranks;
    next = feed.next;
    ends = feed.ends;
    errorMessage = feed.error;

    // Things the people you follow (and you) have shared. Each log or list
    // is still one entry: if its author is followed too, or several people
    // shared it, the entry just says so.
    for (const sh of feed.shares) {
      const target = sh.log_id ?? sh.list_id;
      if (!target) continue;
      const sharer: Sharer = {
        id: sh.user_id,
        name: sh.user_id === viewerId ? "You" : (sh.profiles?.username ?? null),
      };
      const found = sharedBy.get(target);
      if (found) found.sharers.push(sharer);
      else sharedBy.set(target, { sharers: [sharer], latest: sh.created_at });
    }

    // Which of these the viewer has liked and shared, and who they have
    // blocked: different for each person, so never cached
    const viewer = await getViewerState(supabase, viewerId, {
      logIds: logs.map((l) => l.id),
      listIds: lists.map((l) => l.id),
    });
    likedSet = viewer.likedLogs;
    sharedSet = viewer.sharedLogs;
    likedLists = viewer.likedLists;
    sharedLists = viewer.sharedLists;
    hiddenItems = viewer.hiddenItems;
    // Lists keep their place, with blank tiles for the items the viewer hid
    for (const [id, thumbs] of Object.entries(feed.previews)) {
      previews.set(id, markHidden(thumbs, viewer.hiddenItems));
    }

    // Posts by people the viewer has blocked are left out, including ones
    // shared by people the viewer follows, and so are reviews of items the
    // viewer has hidden
    logs = withoutHiddenItems(
      logs.filter((l) => !viewer.blocked.has(l.user_id)),
      viewer.hiddenItems,
      (l) => l.item_id,
    );
    lists = lists.filter((l) => !viewer.blocked.has(l.user_id));
    // Replies are left out when the person who wrote them or the owner of what
    // they were written on is blocked, or the review is of an adult item the
    // viewer hides or of an item they have hidden. A reply on something that
    // is gone is left out too.
    replies = withoutHiddenItems(
      feed.replies.filter(
        (r) =>
          r.logs !== null &&
          r.logs.profiles !== null &&
          !viewer.blocked.has(r.user_id) &&
          !viewer.blocked.has(r.logs.user_id) &&
          !(viewer.sfwMode === "hide" && aboutAdultItem(r.logs)),
      ),
      viewer.hiddenItems,
      (r) => r.logs?.item_id,
    );
    listReplies = feed.listReplies.filter(
      (r) =>
        r.lists !== null &&
        !viewer.blocked.has(r.user_id) &&
        !viewer.blocked.has(r.lists.user_id),
    );
    const [commentAuthors, listCommentAuthors] = await Promise.all([
      authorsOf(
        supabase,
        "comments",
        replies.flatMap((r) => (r.reply_to_id ? [r.reply_to_id] : [])),
      ),
      authorsOf(
        supabase,
        "list_comments",
        listReplies.flatMap((r) => (r.reply_to_id ? [r.reply_to_id] : [])),
      ),
    ]);
    replyToAuthors = new Map([...commentAuthors, ...listCommentAuthors]);
    // So are reviews of adult items, when the viewer hides them
    logs = shownEntries(logs, viewer.sfwMode, aboutAdultItem);

    // Every entry gets a date to sort by. On Following, something that was
    // shared counts from the moment it was last shared (if that is later
    // than when it was made), so it shows up once, near the top.
    const effective = (id: string, own: string) => {
      const sh = sharedBy.get(id);
      return sh && new Date(sh.latest) > new Date(own) ? sh.latest : own;
    };
    const byDate = (a: Entry, b: Entry) =>
      new Date(b.date).getTime() - new Date(a.date).getTime();

    reviewEntries = logs.map(
      (log): Entry => ({
        kind: "log",
        date: effective(log.id, log.logged_at),
        log,
        sharers: sharedBy.get(log.id)?.sharers ?? [],
      }),
    );
    listEntries = lists.map(
      (list): Entry => ({
        kind: "list",
        date: effective(list.id, list.activity_at),
        list,
        sharers: sharedBy.get(list.id)?.sharers ?? [],
      }),
    );
    if (mode === "following") {
      reviewEntries.sort(byDate);
      listEntries.sort(byDate);
    }
  }

  // The two kinds of card. Their layout follows the width of the column they
  // sit in (the "@xl:" variants), not the width of the screen.
  const renderList = (l: ListRow, sharers: Sharer[]) => (
    <ListCard
      key={`list-${l.id}`}
      list={l}
      thumbs={previews.get(l.id) ?? []}
      hiddenItems={hiddenItems}
      viewerId={viewerId}
      liked={likedLists.has(l.id)}
      shared={sharedLists.has(l.id)}
      sharers={sharers}
    />
  );

  const renderLog = (row: LogRow, sharers: Sharer[]) => (
    <LogCard
      key={`log-${row.id}`}
      log={row}
      viewerId={viewerId}
      liked={likedSet.has(row.id)}
      shared={sharedSet.has(row.id)}
      sharers={sharers}
    />
  );

  const renderEntry = (entry: Entry) =>
    entry.kind === "log"
      ? renderLog(entry.log, entry.sharers)
      : renderList(entry.list, entry.sharers);

  const toCard = (entry: Entry): FeedCard => {
    const id = entry.kind === "log" ? entry.log.id : entry.list.id;
    return {
      key: `${entry.kind}-${id}`,
      order: {
        score: scores[id] ?? 0,
        rank: ranks[id] ?? 0,
        time: Date.parse(entry.date),
      },
      card: renderEntry(entry),
    };
  };

  // Replies on reviews sit in the reviews column and replies on lists in the
  // lists column, each at the time it was written. They look like the replies in a diary, with the name of
  // whoever wrote them.
  const now = Date.now();
  const t = await getTranslations();
  const locale = await getLocale();
  const nameOf = (userId: string, username: string | undefined) =>
    userId === viewerId ? t("common.you") : (username ?? t("common.someone"));
  const replyCard = (
    id: string,
    kind: "comment" | "list_comment",
    r: {
      user_id: string;
      parent_id: string | null;
      reply_to_id: string | null;
      body: string;
      created_at: string;
      profiles: { username: string } | null;
    },
    href: string,
    where: string,
  ): FeedCard => ({
    key: `${kind === "comment" ? "reply" : "list-reply"}-${id}`,
    order: { score: 0, rank: 0, time: Date.parse(r.created_at) },
    card: (
      <DiaryReplyCard
        key={`${kind}-${id}`}
        replyId={id}
        kind={kind}
        cardKey=""
        ago={timeAgo(r.created_at, now, t, locale)}
        href={href}
        isReply={r.parent_id !== null}
        replyingTo={
          r.reply_to_id ? (replyToAuthors.get(r.reply_to_id) ?? null) : null
        }
        where={where}
        body={r.body}
        owner={nameOf(r.user_id, r.profiles?.username)}
        ownerHref={
          r.profiles
            ? `/u/${encodeURIComponent(r.profiles.username)}`
            : undefined
        }
      />
    ),
  });
  const reviewReplyCards = replies.flatMap((r) =>
    r.logs?.profiles
      ? [
          replyCard(
            r.id,
            "comment",
            r,
            `/u/${encodeURIComponent(r.logs.profiles.username)}/${r.logs.id}`,
            t("activity.replyWhereReview", {
              name: r.logs.profiles.username,
              title: r.logs.items?.title ?? t("activity.anItem"),
            }),
          ),
        ]
      : [],
  );
  const listReplyCards = listReplies.flatMap((r) =>
    r.lists
      ? [
          replyCard(
            r.id,
            "list_comment",
            r,
            `/list/${r.lists.id}`,
            t("activity.replyWhereList", {
              name: r.lists.profiles?.username ?? t("common.someone"),
              title: r.lists.title,
            }),
          ),
        ]
      : [],
  );
  const byTime = (a: FeedCard, b: FeedCard) =>
    mode === "following" ? b.order.time - a.order.time : 0;
  const reviewCards = [...reviewEntries.map(toCard), ...reviewReplyCards].sort(
    byTime,
  );
  const listCards = [...listEntries.map(toCard), ...listReplyCards].sort(
    byTime,
  );

  return {
    reviews: reviewCards,
    lists: listCards,
    next,
    ends,
    error: errorMessage,
    needsSignIn: mode === "following" && !viewerId,
    noFollows: mode === "following" && Boolean(viewerId) && followedCount === 0,
    viewerId,
    followedCount,
  };
}
