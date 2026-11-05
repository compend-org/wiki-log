import Link from "next/link";
import { connection } from "next/server";
import Avatar from "@/components/Avatar";
import BalancedColumns from "@/components/BalancedColumns";
import ItemImage from "@/components/ItemImage";
import LikeButton from "@/components/LikeButton";
import ListCard from "@/components/ListCard";
import LoadMore from "@/components/LoadMore";
import ShareButton from "@/components/ShareButton";
import ShareIcon from "@/components/ShareIcon";
import Stars from "@/components/Stars";
import { getAdminIds } from "@/lib/admin";
import { getBlockedIds } from "@/lib/blocks";
import {
  getPublicFeed,
  getTrendingFeed,
  type ListRow,
  type LogRow,
  type Thumb,
} from "@/lib/feedData";
import { commentLabel, sharedLabel } from "@/lib/format";
import { getLikedListSet, getLikedSet } from "@/lib/likes";
import { PAGE_SIZE, startOfMinute } from "@/lib/paging";
import { TRENDING_HOURS } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import AdminBadge from "./AdminBadge";
import ReviewText from "./ReviewText";

type Mode = "following" | "everyone" | "trending";

type PreviewRow = {
  list_id: string;
  position: number;
  items: Thumb | null;
};

// `sharers` are the people you follow (or you) who shared this entry, newest
// first. It is only filled in on the Following tab.
type Entry =
  | { kind: "log"; date: string; log: LogRow; sharers: string[] }
  | { kind: "list"; date: string; list: ListRow; sharers: string[] };

type ShareRow = {
  user_id: string;
  log_id: string | null;
  list_id: string | null;
  created_at: string;
  profiles: { username: string } | null;
};

export default async function Feed({
  mode,
  limit = PAGE_SIZE,
  asOf,
}: {
  mode: Mode;
  limit?: number;
  // When this feed was first loaded. Left out on the first page.
  asOf?: string;
}) {
  await connection();
  const snapshot = asOf ?? new Date().toISOString();
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId: string | undefined = claimsData?.claims?.sub;
  const adminIds = await getAdminIds();

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

  let entries: Entry[] = [];
  let reviewEntries: Entry[] = [];
  let listEntries: Entry[] = [];
  let hasMore = false;
  let reviewsHaveMore = false;
  let listsHaveMore = false;
  let errorMessage = "";
  let likedSet = new Set<string>();
  let likedLists = new Set<string>();
  let sharedSet = new Set<string>();
  let sharedLists = new Set<string>();
  // Following only: who shared each log or list id, and when most recently
  const sharedBy = new Map<string, { names: string[]; latest: string }>();
  let scores: Record<string, number> = {};
  const previews = new Map<string, Thumb[]>();

  if (mode !== "following" || authorIds.length > 0) {
    let logs: LogRow[] = [];
    let lists: ListRow[] = [];

    if (mode === "following") {
      const [logsRes, listsRes] = await Promise.all([
        supabase
          .from("logs")
          .select(
            "id, user_id, item_id, rating, review, logged_at, items(title, image_url), profiles!logs_user_id_profiles_fkey(username, avatar_path), likes(count), comments(count), shares(count)",
          )
          .in("user_id", authorIds)
          .lte("logged_at", snapshot)
          .order("logged_at", { ascending: false })
          .limit(limit + 1),
        supabase
          .from("lists")
          .select(
            "id, user_id, title, ranked, created_at, profiles!lists_user_id_profiles_fkey(username, avatar_path), list_items(count), list_likes(count), list_comments(count), shares(count)",
          )
          .in("user_id", authorIds)
          .lte("created_at", snapshot)
          .order("created_at", { ascending: false })
          .limit(limit + 1),
      ]);
      if (logsRes.error) errorMessage = logsRes.error.message;
      else if (listsRes.error) errorMessage = listsRes.error.message;

      logs = (logsRes.data ?? []) as unknown as LogRow[];
      // Empty lists stay out of the feed until they have something in them
      lists = ((listsRes.data ?? []) as unknown as ListRow[]).filter(
        (l) => (l.list_items?.[0]?.count ?? 0) > 0,
      );

      // Things the people you follow (and you) have shared. Each log or
      // list is still one entry: if its author is followed too, or several
      // people shared it, the entry just says so.
      const { data: shareData, error: shareError } = await supabase
        .from("shares")
        .select("user_id, log_id, list_id, created_at, profiles(username)")
        .in("user_id", authorIds)
        .lte("created_at", snapshot)
        .order("created_at", { ascending: false })
        .limit(limit + 1);
      if (shareError) errorMessage = shareError.message;
      const shareRows = (shareData ?? []) as unknown as ShareRow[];

      for (const sh of shareRows) {
        const target = sh.log_id ?? sh.list_id;
        if (!target) continue;
        const name =
          sh.user_id === viewerId
            ? "You"
            : (sh.profiles?.username ?? "Someone");
        const found = sharedBy.get(target);
        if (found) found.names.push(name);
        else sharedBy.set(target, { names: [name], latest: sh.created_at });
      }

      // Shared things whose author isn't already in the lists above
      const haveLogs = new Set(logs.map((l) => l.id));
      const haveLists = new Set(lists.map((l) => l.id));
      const missingLogs = [
        ...new Set(
          shareRows
            .map((r) => r.log_id)
            .filter((id): id is string => !!id && !haveLogs.has(id)),
        ),
      ];
      const missingLists = [
        ...new Set(
          shareRows
            .map((r) => r.list_id)
            .filter((id): id is string => !!id && !haveLists.has(id)),
        ),
      ];
      const [extraLogs, extraLists] = await Promise.all([
        missingLogs.length > 0
          ? supabase
              .from("logs")
              .select(
                "id, user_id, item_id, rating, review, logged_at, items(title, image_url), profiles!logs_user_id_profiles_fkey(username, avatar_path), likes(count), comments(count), shares(count)",
              )
              .in("id", missingLogs)
          : Promise.resolve({ data: [] }),
        missingLists.length > 0
          ? supabase
              .from("lists")
              .select(
                "id, user_id, title, ranked, created_at, profiles!lists_user_id_profiles_fkey(username, avatar_path), list_items(count), list_likes(count), list_comments(count), shares(count)",
              )
              .in("id", missingLists)
          : Promise.resolve({ data: [] }),
      ]);
      logs = [...logs, ...((extraLogs.data ?? []) as unknown as LogRow[])];
      lists = [
        ...lists,
        ...((extraLists.data ?? []) as unknown as ListRow[]).filter(
          (l) => (l.list_items?.[0]?.count ?? 0) > 0,
        ),
      ];
    } else {
      // Everyone and Trending are the same for every visitor, so they are
      // cached and shared. The viewer's own hearts are looked up below.
      const pub =
        mode === "trending"
          ? await getTrendingFeed(limit)
          : await getPublicFeed(limit, startOfMinute(snapshot));
      logs = pub.logs;
      lists = pub.lists;
      scores = pub.scores;
      errorMessage = pub.error;
      for (const [id, thumbs] of Object.entries(pub.previews)) {
        previews.set(id, thumbs);
      }
    }

    // Posts by people the viewer has blocked are left out, including ones
    // shared by people the viewer follows
    const blocked = await getBlockedIds(supabase, viewerId);
    logs = logs.filter((l) => !blocked.has(l.user_id));
    lists = lists.filter((l) => !blocked.has(l.user_id));

    // Every entry gets a date to sort by. On Following, something that was
    // shared counts from the moment it was last shared (if that is later
    // than when it was made), so it shows up once, near the top.
    const entryId = (e: Entry) => (e.kind === "log" ? e.log.id : e.list.id);
    const effective = (id: string, own: string) => {
      const sh = sharedBy.get(id);
      return sh && new Date(sh.latest) > new Date(own) ? sh.latest : own;
    };
    const byDate = (a: Entry, b: Entry) =>
      new Date(b.date).getTime() - new Date(a.date).getTime();

    const logEntries: Entry[] = logs.map(
      (log): Entry => ({
        kind: "log",
        date: effective(log.id, log.logged_at),
        log,
        sharers: sharedBy.get(log.id)?.names ?? [],
      }),
    );
    const listEntryAll: Entry[] = lists.map(
      (list): Entry => ({
        kind: "list",
        date: effective(list.id, list.created_at),
        list,
        sharers: sharedBy.get(list.id)?.names ?? [],
      }),
    );
    if (mode === "following") {
      logEntries.sort(byDate);
      listEntryAll.sort(byDate);
    }

    // The newest `limit` of the combined list always sit within the newest
    // `limit` of each, so merging and trimming is exact. Trending goes by
    // likes instead of by date.
    const merged: Entry[] = [...logEntries, ...listEntryAll].sort((a, b) =>
      mode === "trending"
        ? (scores[entryId(b)] ?? 0) - (scores[entryId(a)] ?? 0) || byDate(a, b)
        : byDate(a, b),
    );

    hasMore = merged.length > limit;
    entries = merged.slice(0, limit);

    // The wide layout has a column for each kind, so each gets its own top
    // `limit`. A busy stream of reviews can't push every list out.
    reviewEntries = logEntries.slice(0, limit);
    listEntries = listEntryAll.slice(0, limit);
    reviewsHaveMore = logEntries.length > limit;
    listsHaveMore = listEntryAll.length > limit;
    const shownLogs = reviewEntries.map((e) => (e as { log: LogRow }).log);
    const shownLists = listEntries.map((e) => (e as { list: ListRow }).list);

    // Which of these the viewer has liked: different for each person, so
    // never cached
    likedSet = await getLikedSet(supabase, viewerId, shownLogs);

    // And which of these the viewer has shared
    if (viewerId) {
      const [logShares, listShares] = await Promise.all([
        shownLogs.length > 0
          ? supabase
              .from("shares")
              .select("log_id")
              .eq("user_id", viewerId)
              .in(
                "log_id",
                shownLogs.map((l) => l.id),
              )
          : Promise.resolve({ data: [] }),
        shownLists.length > 0
          ? supabase
              .from("shares")
              .select("list_id")
              .eq("user_id", viewerId)
              .in(
                "list_id",
                shownLists.map((l) => l.id),
              )
          : Promise.resolve({ data: [] }),
      ]);
      sharedSet = new Set(
        (logShares.data ?? []).map((r) => (r as { log_id: string }).log_id),
      );
      sharedLists = new Set(
        (listShares.data ?? []).map((r) => (r as { list_id: string }).list_id),
      );
    }

    if (shownLists.length > 0) {
      const ids = shownLists.map((l) => l.id);

      // Everyone's and Trending's previews came with the cached data
      if (mode === "following") {
        const { data: previewData } = await supabase
          .from("list_items")
          .select("list_id, position, items(title, image_url)")
          .in("list_id", ids)
          .lte("position", 12)
          .order("position");
        for (const row of (previewData ?? []) as unknown as PreviewRow[]) {
          const arr = previews.get(row.list_id) ?? [];
          arr.push({
            title: row.items?.title ?? "Unknown item",
            image_url: row.items?.image_url ?? null,
          });
          previews.set(row.list_id, arr);
        }
      }

      likedLists = await getLikedListSet(supabase, viewerId, shownLists);
    }
  }

  const needsSignIn = mode === "following" && !viewerId;
  const noFollows =
    mode === "following" && Boolean(viewerId) && followedCount === 0;

  // The two kinds of card. Their layout follows the width of the column they
  // sit in (the "@xl:" variants), not the width of the screen.
  const renderList = (l: ListRow, sharers: string[]) => (
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

  const renderLog = (row: LogRow, sharers: string[]) => {
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
          />
        </Link>

        <div className="flex min-w-0 flex-col gap-1">
          {sharers.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <ShareIcon className="h-3.5 w-3.5" />
              {sharedLabel(sharers)}
            </span>
          )}
          <span className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
            {author ? (
              <Link
                href={`/u/${encodeURIComponent(author)}`}
                className="relative z-10 inline-flex items-center gap-1.5 hover:underline"
              >
                <Avatar name={author} path={avatarPath} size={16} />
                {author}
              </Link>
            ) : (
              <span>Someone</span>
            )}
            {adminIds.has(row.user_id) && <AdminBadge />}
            <span>logged</span>
          </span>
          <Link
            href={`/item/${row.item_id}`}
            className="relative z-10 w-fit font-semibold"
          >
            {title}
          </Link>
          <Stars rating={row.rating} />
          <div className="flex flex-nowrap items-center gap-2.5 whitespace-nowrap text-xs text-muted">
            <span className="min-w-0 truncate">
              {new Date(row.logged_at).toLocaleDateString()}
            </span>

            <span className="relative z-10">
              <LikeButton
                viewerId={viewerId ?? null}
                authorId={row.user_id}
                logId={row.id}
                initialCount={row.likes?.[0]?.count ?? 0}
                initiallyLiked={likedSet.has(row.id)}
              />
            </span>

            <span className="relative z-10">
              <ShareButton
                viewerId={viewerId ?? null}
                ownerId={row.user_id}
                kind="log"
                targetId={row.id}
                initialCount={row.shares?.[0]?.count ?? 0}
                initiallyShared={sharedSet.has(row.id)}
              />
            </span>

            {reviewHref && (
              <Link href={reviewHref} className="relative z-10 hover:underline">
                {commentLabel(row.comments?.[0]?.count ?? 0)}
              </Link>
            )}

            <Link
              href={`/item/${row.item_id}#log`}
              className="relative z-10 hover:underline"
            >
              Log
            </Link>
          </div>
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

  return (
    <section className="flex flex-col gap-4">
      {needsSignIn && (
        <p className="text-center text-muted">
          <Link href="/login" className="underline">
            Sign in
          </Link>{" "}
          to follow people and see what they log here.
        </p>
      )}

      {noFollows && (
        <p className="text-center text-muted">
          You&apos;re not following anyone yet. Use the search icon at the top
          to find people and follow them to fill this feed, or switch to
          Everyone.
        </p>
      )}

      {errorMessage && (
        <p className="text-center text-danger">{errorMessage}</p>
      )}

      {/* Only when there is genuinely nothing to show */}
      {!needsSignIn && !noFollows && !errorMessage && entries.length === 0 && (
        <p className="text-center text-muted">
          {mode === "following"
            ? "Nothing here yet. Log something, or follow people to see what they log."
            : mode === "trending"
              ? `Nothing has been liked in the last ${TRENDING_HOURS} hours.`
              : "Nothing here yet."}
        </p>
      )}

      {entries.length > 0 && (
        <>
          {/* Narrow screens: one column, reviews and lists together */}
          <div className="@container flex flex-col gap-4 lg:hidden">
            {entries.map(renderEntry)}
          </div>

          {/* Wide screens: reviews on the left, lists on the right */}
          <BalancedColumns
            leftHasMore={reviewsHaveMore}
            rightHasMore={listsHaveMore}
            left={
              <>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Reviews
                </h2>
                {reviewEntries.length === 0 ? (
                  <p className="text-sm text-muted">No reviews yet.</p>
                ) : (
                  reviewEntries.map(renderEntry)
                )}
              </>
            }
            right={
              <>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Lists
                </h2>
                {listEntries.length === 0 ? (
                  <p className="text-sm text-muted">No lists yet.</p>
                ) : (
                  listEntries.map(renderEntry)
                )}
              </>
            }
          />
        </>
      )}

      {hasMore && (
        <LoadMore
          key={limit}
          href={`/?tab=${mode}&limit=${limit + PAGE_SIZE}&asOf=${encodeURIComponent(snapshot)}`}
        />
      )}
    </section>
  );
}
