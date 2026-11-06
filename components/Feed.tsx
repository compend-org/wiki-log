// ABOUTME: The home page feeds (Following, Everyone and Trending), a page at a time.
// ABOUTME: Renders each page's cards on the server; FeedPages adds later pages below.
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import CardActions from "@/components/CardActions";
import FeedPages from "@/components/FeedPages";
import ItemImage from "@/components/ItemImage";
import LikeButton from "@/components/LikeButton";
import ListCard from "@/components/ListCard";
import ShareButton from "@/components/ShareButton";
import ShareIcon from "@/components/ShareIcon";
import Stars from "@/components/Stars";
import UserName from "@/components/UserName";
import {
  getFollowingFeed,
  getPublicFeed,
  getTrendingFeed,
  type ListRow,
  type LogRow,
  type PublicFeed,
  type Thumb,
} from "@/lib/feedData";
import { timeAgo } from "@/lib/format";
import {
  type ColumnEnd,
  type FeedCursor,
  type FeedOrder,
  FIRST_PAGE,
  startOfMinute,
} from "@/lib/paging";
import { TRENDING_HOURS } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { getViewerState } from "@/lib/viewerState";
import ReviewText from "./ReviewText";
import SharedLabel, { type Sharer } from "./SharedLabel";

export type FeedMode = "following" | "everyone" | "trending";

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
};

// One page of a feed as it stood at `asOf`, rendered for the viewer. Each of
// the two columns, reviews and lists, carries on from where `cursor` says.
export async function loadFeedPage(
  mode: FeedMode,
  asOf: string,
  cursor: FeedCursor,
): Promise<FeedPage> {
  const renderedAt = Date.now();
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId: string | undefined = claimsData?.claims?.sub;

  // Following shows the people you follow and you, so your own entries are in
  // it as well
  let followedCount = 0;
  let authorIds: string[] = [];
  if (mode === "following" && viewerId) {
    const { data: followRows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", viewerId);
    const followed = (followRows ?? []).map((r) => r.following_id as string);
    followedCount = followed.length;
    authorIds = [...new Set([...followed, viewerId])];
  }

  let reviewEntries: Entry[] = [];
  let listEntries: Entry[] = [];
  let next: FeedCursor = { reviews: null, lists: null };
  let ends: FeedPage["ends"] = { reviews: null, lists: null };
  let errorMessage = "";
  let likedSet = new Set<string>();
  let likedLists = new Set<string>();
  let sharedSet = new Set<string>();
  let sharedLists = new Set<string>();
  // Following only: who shared each log or list id, and when most recently
  const sharedBy = new Map<string, { sharers: Sharer[]; latest: string }>();
  let scores: Record<string, number> = {};
  let ranks: Record<string, number> = {};
  const previews = new Map<string, Thumb[]>();

  if (mode !== "following" || authorIds.length > 0) {
    // Everyone and Trending are the same for every visitor, so they are
    // cached and shared. Following is the viewer's own. The viewer's own
    // hearts are looked up below.
    const feed: PublicFeed =
      mode === "following"
        ? await getFollowingFeed(supabase, authorIds, asOf, cursor)
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
    for (const [id, thumbs] of Object.entries(feed.previews)) {
      previews.set(id, thumbs);
    }

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

    // Posts by people the viewer has blocked are left out, including ones
    // shared by people the viewer follows
    logs = logs.filter((l) => !viewer.blocked.has(l.user_id));
    lists = lists.filter((l) => !viewer.blocked.has(l.user_id));

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
        date: effective(list.id, list.created_at),
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
      viewerId={viewerId}
      liked={likedLists.has(l.id)}
      shared={sharedLists.has(l.id)}
      sharers={sharers}
    />
  );

  const renderLog = (row: LogRow, sharers: Sharer[]) => {
    const title = row.items?.title ?? "Unknown item";
    const author = row.profiles?.username;
    const avatarPath = row.profiles?.avatar_path ?? null;
    const reviewHref = author
      ? `/u/${encodeURIComponent(author)}/${row.id}`
      : null;

    return (
      <div
        key={`log-${row.id}`}
        className={`card relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-3 hover:border-accent/60 ${
          row.review ? "@xl:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.2fr)]" : ""
        }`}
      >
        {reviewHref && (
          <Link
            href={reviewHref}
            aria-label={`Open ${author}'s review of ${title}`}
            className="absolute inset-0 rounded-[inherit]"
          />
        )}

        <Link
          href={`/item/${row.item_id}`}
          className="relative z-10 shrink-0 self-center"
        >
          <ItemImage
            src={row.items?.image_url}
            alt={title}
            className="h-20 w-20 rounded"
            sourceWidth={250}
          />
        </Link>

        <div className="flex min-w-0 flex-col gap-1">
          {sharers.length > 0 && (
            <span className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
              <ShareIcon className="h-3.5 w-3.5" />
              <SharedLabel sharers={sharers} />
            </span>
          )}
          <span className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
            <UserName
              userId={row.user_id}
              username={author}
              avatarPath={avatarPath}
            />
            <span>logged</span>
            <span className="whitespace-nowrap">
              · {timeAgo(row.logged_at, renderedAt)}
            </span>
          </span>
          <Link
            href={`/item/${row.item_id}`}
            className="relative z-10 w-fit font-semibold"
          >
            {title}
          </Link>
          <Stars rating={row.rating} />
          <CardActions
            like={
              <LikeButton
                viewerId={viewerId ?? null}
                authorId={row.user_id}
                logId={row.id}
                initialCount={row.likes?.[0]?.count ?? 0}
                initiallyLiked={likedSet.has(row.id)}
              />
            }
            share={
              <ShareButton
                viewerId={viewerId ?? null}
                ownerId={row.user_id}
                kind="log"
                targetId={row.id}
                initialCount={row.shares?.[0]?.count ?? 0}
                initiallyShared={sharedSet.has(row.id)}
              />
            }
            commentHref={reviewHref}
            commentCount={row.comments?.[0]?.count ?? 0}
            logHref={`/item/${row.item_id}#log`}
          />
        </div>

        {row.review && (
          <p className="col-span-2 line-clamp-6 whitespace-pre-wrap break-words text-sm @xl:col-span-1 @xl:border-l @xl:border-dashed @xl:border-line @xl:pl-4">
            {<ReviewText text={row.review} />}
          </p>
        )}
      </div>
    );
  };

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

  return {
    reviews: reviewEntries.map(toCard),
    lists: listEntries.map(toCard),
    next,
    ends,
    error: errorMessage,
    needsSignIn: mode === "following" && !viewerId,
    noFollows: mode === "following" && Boolean(viewerId) && followedCount === 0,
  };
}

export default async function Feed({ mode }: { mode: FeedMode }) {
  await connection();
  // When this feed was first loaded. Later pages leave out anything newer.
  const asOf = new Date().toISOString();
  const page = await loadFeedPage(mode, asOf, FIRST_PAGE);
  // A first page can come back with nothing to show, such as only empty
  // lists, while more is still to come
  const hasMore = Boolean(page.next.reviews || page.next.lists);
  const empty =
    page.reviews.length === 0 && page.lists.length === 0 && !hasMore;

  return (
    <section className="flex flex-col gap-4">
      {page.needsSignIn && (
        <p className="text-center text-muted">
          <Link href="/login" className="underline">
            Sign in
          </Link>{" "}
          to follow people and see what they log here.
        </p>
      )}

      {page.noFollows && (
        <p className="text-center text-muted">
          You&apos;re not following anyone yet. Use the search icon at the top
          to find people and follow them to fill this feed, or switch to
          Everyone.
        </p>
      )}

      {page.error && <p className="text-center text-danger">{page.error}</p>}

      {/* Only when there is genuinely nothing to show */}
      {!page.needsSignIn && !page.noFollows && !page.error && empty && (
        <p className="text-center text-muted">
          {mode === "following"
            ? "Nothing here yet. Log something, or follow people to see what they log."
            : mode === "trending"
              ? `Nothing has been liked in the last ${TRENDING_HOURS} hours.`
              : "Nothing here yet."}
        </p>
      )}

      {!empty && <FeedPages mode={mode} asOf={asOf} first={page} />}
    </section>
  );
}
