import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { type CSSProperties, cache } from "react";
import ItemImage from "@/components/items/ItemImage";
import ListLikeButton from "@/components/lists/ListLikeButton";
import ListNotesHint from "@/components/lists/ListNotesHint";
import ListPager from "@/components/lists/ListPager";
import RemovedNotice from "@/components/logs/RemovedNotice";
import ReviewText from "@/components/logs/ReviewText";
import AdminBadge from "@/components/moderation/AdminBadge";
import ReportButton from "@/components/moderation/ReportButton";
import Avatar from "@/components/people/Avatar";
import Comments from "@/components/social/Comments";
import ShareButton from "@/components/social/ShareButton";
import TextLinesIcon from "@/components/ui/TextLinesIcon";
import { getAdminIds } from "@/lib/admin/admin";
import { withoutBlockedComments } from "@/lib/blocks";
import {
  fetchCommentThreads,
  parseThreads,
  THREADS_PER_PAGE,
  threadsHref,
  toCommentItems,
} from "@/lib/comments";
import { FEATURES } from "@/lib/features";
import { isCompoundId, isUuid } from "@/lib/ids";
import { groupRuns } from "@/lib/lists/listGroups";
import {
  fetchGroups,
  fetchListPage,
  pageCount,
  parsePage,
} from "@/lib/lists/listPages";
import { itemPreviewImage, pageMetadata } from "@/lib/metadata";
import { createClient } from "@/lib/supabase/server";
import { getViewerState } from "@/lib/viewerState";

export const instant = false;

// The address of a page of the list
function pageHref(id: string, page: number): string {
  return page === 1 ? `/list/${id}` : `/list/${id}?page=${page}`;
}

type ListRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  ranked: boolean;
  grouped: boolean;
  group_labels: boolean;
  // Only ever set for the author: removed lists are hidden from everyone else
  removed_at: string | null;
  profiles: { username: string; avatar_path: string | null } | null;
  list_likes: { count: number }[];
  shares: { count: number }[];
};

// Keeps the tooltip on screen: the first column's opens to the right, the last
// column's to the left, and the rest are centred. The grid has 3 columns on
// phones and 4 from the sm breakpoint up.
function tooltipPosition(index: number): string {
  const base =
    index % 3 === 0
      ? "left-0"
      : index % 3 === 2
        ? "right-0"
        : "left-1/2 -translate-x-1/2";
  const wide =
    index % 4 === 0
      ? "sm:left-0 sm:right-auto sm:translate-x-0"
      : index % 4 === 3
        ? "sm:left-auto sm:right-0 sm:translate-x-0"
        : "sm:left-1/2 sm:right-auto sm:-translate-x-1/2";
  return `${base} ${wide}`;
}

// The dashed box round a run of items. The grid inside has 3 columns on phones
// and 4 from sm up; --n is how many of them the run fills, and the box is
// exactly wide enough for that many (the box's padding and border, 1.5rem and
// 4px, plus the 0.75rem gaps, are counted out of the full width).
const BOX = [
  "[--cols:3] sm:[--cols:4] [--n:min(var(--count),var(--cols))]",
  "rounded-lg border-2 border-dashed border-line px-3 pt-3 pb-1.5 max-w-full",
  "w-[calc((100%_-_1.5rem_-_4px_-_(var(--cols)_-_1)_*_0.75rem)_/_var(--cols)_*_var(--n)_+_(var(--n)_-_1)_*_0.75rem_+_1.5rem_+_4px)]",
].join(" ");

// The empty space after a short last row, in the grid's bottom right corner.
// It reaches out over the box's padding and border (0.75rem and 2px) and has
// the page's colour, so the box's border doesn't show there; its own top and
// left borders are the step.
const NOTCH = [
  "pointer-events-none bg-background",
  "[grid-column:var(--s3)/-1] sm:[grid-column:var(--s4)/-1]",
  "-mt-1.5 mb-[calc(-0.375rem-2px)] mr-[calc(-0.75rem-2px)]",
  "border-l-2 border-t-2 border-dashed border-line",
].join(" ");

// The list and a page of its entries are cached per request, so the page and
// its metadata share them
const getList = cache(async (id: string): Promise<ListRow | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lists")
    .select(
      "id, user_id, title, description, ranked, grouped, group_labels, removed_at, profiles!lists_user_id_profiles_fkey(username, avatar_path), list_likes(count), shares(count)",
    )
    .eq("id", id)
    .maybeSingle();
  return data as unknown as ListRow | null;
});

// A list can hold up to 10,000 items, more than one response carries, so its
// items are shown a page at a time
const getListPage = cache(async (id: string, page: number) => {
  const supabase = await createClient();
  return fetchListPage(supabase, id, page);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  await connection();
  const { id } = await params;
  if (!isUuid(id)) return {};
  const list = await getList(id);
  if (!list) return {};

  const owner = list.profiles?.username;
  // The picture comes from the top of the list whichever page is open
  const { entries } = await getListPage(id, 1);
  const shown = entries.find((e) => e.imageUrl && !e.imageHidden);
  return pageMetadata({
    title: owner ? `${list.title} by ${owner}` : list.title,
    // A compound's drawing is too small to show as it is
    ...(shown?.imageUrl && isCompoundId(shown.itemId)
      ? itemPreviewImage(shown.itemId, shown.imageUrl)
      : { image: shown?.imageUrl }),
  });
}

export default async function ListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const renderedAt = Date.now();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const query = await searchParams;
  const page = parsePage(query.page);

  const supabase = await createClient();

  const list = await getList(id);
  if (!list) notFound();

  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId: string | undefined = claimsData?.claims?.sub;
  const isOwner = viewerId === list.user_id;

  const [{ entries, total }, noted] = await Promise.all([
    getListPage(id, page),
    // How many of the list's items have a note, on any page
    supabase
      .from("list_items")
      .select("item_id", { count: "exact", head: true })
      .eq("list_id", id)
      .not("note", "is", null),
  ]);
  const notedCount = noted.count ?? 0;
  const lastPage = pageCount(total);
  // A page past the end (say, after items were removed) goes to the last one
  if (page > lastPage) redirect(pageHref(id, lastPage));

  // The owner is asked to write notes until the list has some, unless they
  // said not to
  let suggestNotes = false;
  if (isOwner && viewerId && notedCount === 0 && total > 0) {
    const { data: settings } = await supabase
      .from("user_settings")
      .select("list_notes_hint_dismissed")
      .eq("user_id", viewerId)
      .maybeSingle();
    suggestNotes = !settings?.list_notes_hint_dismissed;
  }

  // The newest threads of comments, whole; older ones load on request
  const threads = parseThreads(query.comments);
  const commentPage = await fetchCommentThreads(
    supabase,
    "list_comments",
    id,
    threads,
  );

  // Whether the viewer has liked and shared this list, which of its comments
  // they have liked, and who they have blocked
  const viewer = await getViewerState(supabase, viewerId, {
    listIds: [id],
    listCommentIds: commentPage.rows.map((c) => c.id),
  });

  const adminIds = await getAdminIds();
  const allComments = toCommentItems(
    commentPage.rows,
    adminIds,
    viewer.likedListComments,
    renderedAt,
  );

  // Comments by people the viewer has blocked are left out
  const comments = withoutBlockedComments(allComments, viewer.blocked);
  const commentTotal =
    commentPage.total - (allComments.length - comments.length);

  // A grouped list is shown in its groups (a plain one when the feature is off)
  const grouped = list.grouped && FEATURES.groupedLists;
  const runs = groupRuns(
    grouped ? await fetchGroups(supabase, id) : [],
    entries,
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      {list.removed_at && <RemovedNotice noun="list" />}
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{list.title}</h1>
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
          <span>
            A {list.ranked ? "ranked " : grouped ? "grouped " : ""}list by
          </span>
          {list.profiles ? (
            <Link
              href={`/u/${encodeURIComponent(list.profiles.username)}`}
              className="inline-flex items-center gap-1.5 hover:underline"
            >
              <Avatar
                name={list.profiles.username}
                path={list.profiles.avatar_path}
                size={20}
              />
              {list.profiles.username}
            </Link>
          ) : (
            <span>someone</span>
          )}
          {adminIds.has(list.user_id) && <AdminBadge />}
          <span>
            · {total.toLocaleString("en-US")} {total === 1 ? "item" : "items"}
          </span>
        </p>
        {list.description && (
          <p className="mt-2 whitespace-pre-wrap">
            <ReviewText text={list.description} />
          </p>
        )}
        <div className="mt-2 flex items-center gap-4">
          <ListLikeButton
            viewerId={viewerId ?? null}
            listId={id}
            ownerId={list.user_id}
            initialCount={list.list_likes?.[0]?.count ?? 0}
            initiallyLiked={viewer.likedLists.has(id)}
          />
          <ShareButton
            viewerId={viewerId ?? null}
            ownerId={list.user_id}
            kind="list"
            targetId={id}
            shareCount={list.shares?.[0]?.count ?? 0}
            shared={viewer.sharedLists.has(id)}
          />
          <ReportButton
            viewerId={viewerId ?? null}
            ownerId={list.user_id}
            kind="list"
            targetId={id}
          />
          {isOwner && (
            <Link href={`/list/${id}/edit`} className="text-sm underline">
              Edit list
            </Link>
          )}
        </div>
        {suggestNotes && viewerId && (
          <ListNotesHint userId={viewerId} editHref={`/list/${id}/edit`} />
        )}
      </header>

      {total === 0 && <p className="text-muted">This list is empty.</p>}

      <ListPager page={page} last={lastPage} href={(p) => pageHref(id, p)} />

      {runs
        .filter((run) => run.entries.length > 0)
        .map((run, runIndex) => (
          // A grouped list has a dashed box round each group, with the group's
          // name above it; a plain list's items are in one run
          <section
            key={run.group?.id ?? `run-${runIndex}`}
            className="flex flex-col gap-1.5"
          >
            {grouped && list.group_labels && run.group?.name && (
              <h2 className="text-lg font-semibold">{run.group.name}</h2>
            )}
            {/* The box is only as wide as its items need */}
            <div
              style={
                {
                  "--count": run.entries.length,
                  // Where the unfilled part of the last row starts, in a
                  // grid of 3 columns and one of 4
                  "--s3": (run.entries.length % 3) + 1,
                  "--s4": (run.entries.length % 4) + 1,
                } as CSSProperties
              }
              className={BOX}
            >
              <ul className="grid grid-cols-[repeat(var(--n),minmax(0,1fr))] gap-3">
                {run.entries.map((entry, index) => {
                  const title = entry.title;

                  return (
                    <li key={entry.itemId} className="group relative">
                      <Link
                        href={`/item/${entry.itemId}`}
                        className="flex flex-col gap-1"
                      >
                        <div className="relative">
                          <ItemImage
                            src={entry.imageUrl}
                            nsfw={entry.nsfw}
                            alt={title}
                            className={`aspect-square w-full rounded-lg ${
                              entry.note
                                ? "group-hover:ring-2 group-hover:ring-accent group-focus-within:ring-2 group-focus-within:ring-accent"
                                : ""
                            }`}
                          />
                          {list.ranked && (
                            <span className="absolute left-1 top-1 rounded bg-background/80 px-1.5 text-sm font-bold text-accent">
                              {entry.rank}
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="min-w-0 flex-1 truncate text-xs">
                            {title}
                          </span>
                          {entry.note && (
                            <span
                              title="Has a note"
                              className="shrink-0 self-center"
                            >
                              <TextLinesIcon />
                              <span className="sr-only">Has a note</span>
                            </span>
                          )}
                        </div>
                      </Link>

                      {entry.note && (
                        <div
                          role="tooltip"
                          className={`card pointer-events-none absolute bottom-full z-30 mb-2 hidden w-64 max-w-[calc(100vw-2rem)] flex-col gap-1 p-3 text-left group-hover:flex group-focus-within:flex ${tooltipPosition(
                            index,
                          )}`}
                        >
                          <span className="font-semibold">{title}</span>
                          <p className="line-clamp-8 whitespace-pre-wrap break-words text-sm">
                            {entry.note}
                          </p>
                        </div>
                      )}
                    </li>
                  );
                })}
                {/* When the last row isn't full, the box steps in round the
                      empty space: this fills it with the page's colour, over
                      the box's own border, and draws the step */}
                <li
                  aria-hidden="true"
                  className={`${run.entries.length > 3 && run.entries.length % 3 !== 0 ? "block" : "hidden"} ${run.entries.length > 4 && run.entries.length % 4 !== 0 ? "sm:block" : "sm:hidden"} ${NOTCH}`}
                />
              </ul>
            </div>
          </section>
        ))}

      <ListPager page={page} last={lastPage} href={(p) => pageHref(id, p)} />

      <Comments
        comments={comments}
        viewerId={viewerId ?? null}
        table="list_comments"
        scope={{ list_id: id }}
        ownerId={list.user_id}
        total={commentTotal}
        earlierHref={
          commentPage.olderThreads > 0
            ? threadsHref(`/list/${id}`, query, threads + THREADS_PER_PAGE)
            : null
        }
      />
    </main>
  );
}
