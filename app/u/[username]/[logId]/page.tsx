import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import AlsoLiked from "@/components/items/AlsoLiked";
import ItemImage from "@/components/items/ItemImage";
import OwnerControls from "@/components/logs/OwnerControls";
import RemovedNotice from "@/components/logs/RemovedNotice";
import ReviewText from "@/components/logs/ReviewText";
import Stars from "@/components/logs/Stars";
import AdminBadge from "@/components/moderation/AdminBadge";
import ReportButton from "@/components/moderation/ReportButton";
import Avatar from "@/components/people/Avatar";
import Comments from "@/components/social/Comments";
import LikeButton from "@/components/social/LikeButton";
import ShareButton from "@/components/social/ShareButton";
import ShareImageButton from "@/components/social/ShareImageButton";
import { getAdminIds } from "@/lib/admin/admin";
import { withoutBlockedComments } from "@/lib/blocks";
import {
  fetchCommentThreads,
  parseThreads,
  THREADS_PER_PAGE,
  threadsHref,
  toCommentItems,
} from "@/lib/comments";
import { getAlsoLiked } from "@/lib/feed/alsoLiked";
import { entryPicture, plainReview, starText, timeAgo } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { likeKey } from "@/lib/likes";
import { itemPreviewImage, pageMetadata } from "@/lib/metadata";
import { getProfileByName } from "@/lib/profiles";
import { getReview } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/server";
import { getViewerState } from "@/lib/viewerState";

export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; logId: string }>;
}): Promise<Metadata> {
  await connection();
  const { username, logId } = await params;
  if (!isUuid(logId)) return {};
  const profile = await getProfileByName(username);
  if (!profile) return {};
  const log = await getReview(logId, profile.id);
  if (!log) return {};

  const itemTitle = log.items?.title ?? "Unknown item";
  return pageMetadata({
    title: `${profile.username} on ${itemTitle}`,
    // A removed review's text stays out of previews and search results
    description:
      [starText(log.rating), !log.removed_at && plainReview(log.review)]
        .filter(Boolean)
        .join(" ") || undefined,
    path: `/u/${encodeURIComponent(profile.username)}/${log.id}`,
    // A picture the author chose has its own route; other reviews share their
    // item's
    ...(log.image_url
      ? {
          image: `/u/${encodeURIComponent(profile.username)}/${log.id}/picture`,
        }
      : log.items?.image_url &&
        !log.items.image_hidden &&
        itemPreviewImage(log.item_id, log.items.image_url)),
  });
}

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string; logId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const renderedAt = Date.now();
  const { username: rawName, logId } = await params;
  const query = await searchParams;
  const threads = parseThreads(query.comments);

  const profile = await getProfileByName(rawName);
  if (!profile) notFound();

  const supabase = await createClient();

  // Old links used the item's id: send them to that person's latest entry
  if (/^Q\d+$/.test(logId)) {
    const { data: latest } = await supabase
      .from("logs")
      .select("id")
      .eq("user_id", profile.id)
      .eq("item_id", logId)
      .order("logged_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest) {
      redirect(`/u/${encodeURIComponent(profile.username)}/${latest.id}`);
    }
    notFound();
  }
  if (!isUuid(logId)) notFound();

  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId: string | undefined = claimsData?.claims?.sub;

  const log = await getReview(logId, profile.id);
  if (!log) notFound();

  // The newest threads of comments, whole. Older ones load on request.
  const commentPage = await fetchCommentThreads(
    supabase,
    "comments",
    log.id,
    threads,
  );
  const commentRows = commentPage.rows;

  // Whether the viewer has liked and shared this review, which of these
  // comments they have liked, and who they have blocked
  const viewer = await getViewerState(supabase, viewerId, {
    logIds: [log.id],
    commentIds: commentRows.map((c) => c.id),
  });

  const adminIds = await getAdminIds();
  const allComments = toCommentItems(
    commentRows,
    adminIds,
    viewer.likedComments,
    renderedAt,
  );

  // Comments by people the viewer has blocked are left out
  const comments = withoutBlockedComments(allComments, viewer.blocked);
  const commentTotal =
    commentPage.total - (allComments.length - comments.length);
  const reviewHref = `/u/${encodeURIComponent(profile.username)}/${log.id}`;

  const alsoLiked = await getAlsoLiked(supabase, [log]);
  const title = log.items?.title ?? "Unknown item";
  const isOwner = viewerId === log.user_id;

  // The part of the card that stays put, with room on the right for the
  // owner's Edit and Delete controls
  const picture = (
    <Link href={`/item/${log.item_id}`} className="shrink-0">
      <ItemImage
        src={entryPicture(log)}
        nsfw={log.items?.nsfw}
        alt={title}
        className="h-28 w-28 rounded"
      />
    </Link>
  );
  const byline = (
    <div className={`flex min-w-0 flex-col gap-1 ${isOwner ? "pr-16" : ""}`}>
      <Link
        href={`/item/${log.item_id}`}
        className="text-xl font-bold [overflow-wrap:anywhere]"
      >
        {title}
      </Link>
      {/* The dot before the date sits in the gap left of it, so when the
            date wraps to the start of a line the dot is clipped away */}
      <p className="flex flex-wrap items-center gap-x-3.5 overflow-hidden text-sm text-muted">
        <span className="flex flex-wrap items-center gap-x-1.5">
          <span>Review by</span>
          <Link
            href={`/u/${encodeURIComponent(profile.username)}`}
            className="inline-flex items-center gap-1.5 hover:underline"
          >
            <Avatar
              name={profile.username}
              path={profile.avatar_path}
              size={20}
            />
            {profile.username}
          </Link>
          {adminIds.has(log.user_id) && <AdminBadge />}
        </span>
        <span className="relative before:absolute before:right-full before:mr-1 before:content-['·']">
          {timeAgo(log.logged_at, renderedAt)}
        </span>
      </p>
      <Stars rating={log.rating} />
    </div>
  );

  // The part the owner can edit
  const body = (
    <>
      {log.review && (
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
          <ReviewText text={log.review} />
        </p>
      )}
    </>
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      {log.removed_at && <RemovedNotice noun="review" />}
      <article className="card flex flex-col gap-3 p-4">
        {isOwner ? (
          <OwnerControls
            logId={log.id}
            rating={log.rating === null ? null : Number(log.rating)}
            review={log.review}
            profileHref={`/u/${encodeURIComponent(profile.username)}`}
            picture={picture}
            byline={byline}
            body={body}
            pictureChoice={
              /^Q\d+$/.test(log.item_id)
                ? {
                    itemId: log.item_id,
                    title,
                    url: entryPicture(log),
                    nsfw: log.items?.nsfw ?? false,
                  }
                : undefined
            }
          />
        ) : (
          <>
            <div className="flex gap-4">
              {picture}
              {byline}
            </div>
            {body}
          </>
        )}
      </article>

      <div className="flex items-center gap-4">
        <LikeButton
          viewerId={viewerId ?? null}
          authorId={log.user_id}
          logId={log.id}
          initialCount={log.likes?.[0]?.count ?? 0}
          initiallyLiked={viewer.likedLogs.has(log.id)}
        />
        <ShareButton
          viewerId={viewerId ?? null}
          ownerId={log.user_id}
          kind="log"
          targetId={log.id}
          shareCount={log.shares?.[0]?.count ?? 0}
          shared={viewer.sharedLogs.has(log.id)}
        />
        <ShareImageButton
          imageHref={`/u/${encodeURIComponent(profile.username)}/${log.id}/image`}
          fileName={`${profile.username}-review.png`}
          className="sm:hidden"
        />
        <ReportButton
          viewerId={viewerId ?? null}
          ownerId={log.user_id}
          kind="log"
          targetId={log.id}
        />
      </div>

      <AlsoLiked
        username={profile.username}
        likes={alsoLiked.get(likeKey(log.user_id, log.item_id)) ?? []}
        allHref={`${reviewHref}/liked`}
      />

      <Comments
        comments={comments}
        viewerId={viewerId ?? null}
        table="comments"
        scope={{ log_id: log.id }}
        ownerId={profile.id}
        total={commentTotal}
        earlierHref={
          commentPage.olderThreads > 0
            ? threadsHref(reviewHref, query, threads + THREADS_PER_PAGE)
            : null
        }
      />
    </main>
  );
}
