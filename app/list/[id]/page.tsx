import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import AdminBadge from "@/components/AdminBadge";
import ReportButton from "@/components/buttons/ReportButton";
import ShareButton from "@/components/buttons/ShareButton";
import Comments from "@/components/Comments";
import ItemImage from "@/components/icons/ItemImage";
import ListLikeButton from "@/components/ListLikeButton";
import ListPager from "@/components/ListPager";
import RemovedNotice from "@/components/RemovedNotice";
import ReviewText from "@/components/ReviewText";
import Stars from "@/components/Stars";
import { getAdminIds } from "@/lib/admin";
import { withoutBlockedComments } from "@/lib/blocks";
import {
  fetchCommentThreads,
  parseThreads,
  THREADS_PER_PAGE,
  threadsHref,
  toCommentItems,
} from "@/lib/comments";
import { timeAgo } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { fetchOwnerLatestLogs } from "@/lib/listOwnerLogs";
import { fetchListPage, pageCount, parsePage } from "@/lib/listPages";
import { pageMetadata } from "@/lib/metadata";
import { createClient } from "@/lib/supabase/server";
import { getViewerState } from "@/lib/viewerState";

export const instant = false;

function pageHref(id: string, page: number): string {
  return page === 1 ? `/list/${id}` : `/list/${id}?page=${page}`;
}

type ListRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  ranked: boolean;
  // Only ever set for the author: removed lists are hidden from everyone else
  removed_at: string | null;
  profiles: { username: string } | null;
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

// The list and a page of its entries are cached per request, so the page and
// its metadata share them
const getList = cache(async (id: string): Promise<ListRow | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lists")
    .select(
      "id, user_id, title, description, ranked, removed_at, profiles!lists_user_id_profiles_fkey(username), list_likes(count), shares(count)",
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
    image: shown?.imageUrl,
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

  const { entries, total } = await getListPage(id, page);
  const lastPage = pageCount(total);
  // A page past the end (say, after items were removed) goes to the last one
  if (page > lastPage) redirect(pageHref(id, lastPage));

  // The list owner's latest log of each item on this page, and how many
  // times they have logged it. Alongside, the newest threads of comments,
  // whole; older ones load on request.
  const itemIds = entries.map((e) => e.itemId);
  const threads = parseThreads(query.comments);
  const [ownerLatest, commentPage] = await Promise.all([
    fetchOwnerLatestLogs(supabase, list.user_id, itemIds),
    fetchCommentThreads(supabase, "list_comments", id, threads),
  ]);

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

  const owner = list.profiles?.username;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      {list.removed_at && <RemovedNotice noun="list" />}
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{list.title}</h1>
        <p className="text-sm text-muted">
          A {list.ranked ? "ranked " : ""}list by{" "}
          {owner ? (
            <Link
              href={`/u/${encodeURIComponent(owner)}`}
              className="underline"
            >
              {owner}
            </Link>
          ) : (
            "someone"
          )}
          {adminIds.has(list.user_id) && (
            <>
              {" "}
              <AdminBadge />
            </>
          )}{" "}
          · {total.toLocaleString("en-US")} {total === 1 ? "item" : "items"}
        </p>
        {list.description && (
          <p className="mt-2 whitespace-pre-wrap">{list.description}</p>
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
            initialCount={list.shares?.[0]?.count ?? 0}
            initiallyShared={viewer.sharedLists.has(id)}
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
      </header>

      {total === 0 && <p className="text-muted">This list is empty.</p>}

      <ListPager page={page} last={lastPage} href={(p) => pageHref(id, p)} />

      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {entries.map((entry, index) => {
          const title = entry.title;
          const info = ownerLatest.get(entry.itemId);

          return (
            <li key={entry.itemId} className="group relative">
              <Link
                href={`/item/${entry.itemId}`}
                className="flex flex-col gap-1"
              >
                <div className="relative">
                  <ItemImage
                    src={entry.imageUrl}
                    alt={title}
                    className="aspect-square w-full rounded-lg"
                  />
                  {list.ranked && (
                    <span className="absolute left-1 top-1 rounded bg-background/80 px-1.5 text-sm font-bold text-accent">
                      {entry.rank}
                    </span>
                  )}
                </div>
                <span className="truncate text-xs">{title}</span>
              </Link>

              {info && (
                <div
                  role="tooltip"
                  className={`card pointer-events-none absolute bottom-full z-30 mb-2 hidden w-64 max-w-[calc(100vw-2rem)] flex-col gap-1 p-3 text-left group-hover:flex group-focus-within:flex ${tooltipPosition(
                    index,
                  )}`}
                >
                  <span className="text-xs text-muted">
                    {owner ? `${owner}'s latest` : "Latest"} ·{" "}
                    {timeAgo(info.latest.logged_at, renderedAt)}
                  </span>
                  <Stars rating={info.latest.rating} />
                  {info.latest.review && (
                    <p className="line-clamp-8 whitespace-pre-wrap break-words text-sm">
                      {<ReviewText text={info.latest.review} plain />}
                    </p>
                  )}
                  {info.latest.rating === null && !info.latest.review && (
                    <p className="text-sm text-muted">
                      Logged, with no rating or review.
                    </p>
                  )}
                  {info.count > 1 && (
                    <span className="text-xs text-muted">
                      {info.count} entries
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

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
