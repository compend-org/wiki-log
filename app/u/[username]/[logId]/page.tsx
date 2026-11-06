import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import AdminBadge from "@/components/AdminBadge";
import AlsoLiked from "@/components/AlsoLiked";
import Avatar from "@/components/Avatar";
import Comments, { type CommentItem } from "@/components/Comments";
import ItemImage from "@/components/ItemImage";
import LikeButton from "@/components/LikeButton";
import OwnerControls from "@/components/OwnerControls";
import ReportButton from "@/components/ReportButton";
import ReviewText from "@/components/ReviewText";
import ShareButton from "@/components/ShareButton";
import ShareImageButton from "@/components/ShareImageButton";
import Stars from "@/components/Stars";
import { getAdminIds } from "@/lib/admin";
import { getAlsoLiked } from "@/lib/alsoLiked";
import { withoutBlockedComments } from "@/lib/blocks";
import { isUuid } from "@/lib/ids";
import { likeKey } from "@/lib/likes";
import { pageMetadata, starText } from "@/lib/metadata";
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
    description: starText(log.rating) || undefined,
    image: log.items?.image_hidden ? null : log.items?.image_url,
  });
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ username: string; logId: string }>;
}) {
  await connection();
  const { username: rawName, logId } = await params;

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

  const commentRows = log.comments;

  // Whether the viewer has liked and shared this review, which of these
  // comments they have liked, and who they have blocked
  const viewer = await getViewerState(supabase, viewerId, {
    logIds: [log.id],
    commentIds: commentRows.map((c) => c.id),
  });

  const adminIds = await getAdminIds();
  const allComments: CommentItem[] = commentRows.map((c) => ({
    id: c.id,
    parentId: c.parent_id,
    body: c.body,
    date: c.created_at.slice(0, 10),
    authorId: c.user_id,
    authorName: c.profiles?.username ?? "Someone",
    authorIsAdmin: adminIds.has(c.user_id),
    likeCount: c.comment_likes?.[0]?.count ?? 0,
    liked: viewer.likedComments.has(c.id),
  }));

  // Comments by people the viewer has blocked are left out
  const comments = withoutBlockedComments(allComments, viewer.blocked);

  const alsoLiked = await getAlsoLiked(supabase, [log]);
  const title = log.items?.title ?? "Unknown item";
  const isOwner = viewerId === log.user_id;

  // The part of the card that stays put, with room on the right for the
  // owner's Edit and Delete controls
  const header = (
    <div className="flex gap-4">
      <Link href={`/item/${log.item_id}`} className="shrink-0">
        <ItemImage
          src={log.items?.image_url}
          alt={title}
          className="h-28 w-28 rounded"
        />
      </Link>
      <div className={`flex min-w-0 flex-col gap-1 ${isOwner ? "pr-16" : ""}`}>
        <Link href={`/item/${log.item_id}`} className="text-xl font-bold">
          {title}
        </Link>
        {/* The dot before the date sits in the gap left of it, so when the
            date wraps to the start of a line the dot is clipped away */}
        <p className="flex flex-wrap items-center gap-x-3.5 overflow-hidden text-sm text-muted">
          <span className="flex flex-wrap items-center gap-x-1.5">
            <span>Review by</span>
            <Link
              href={`/u/${encodeURIComponent(profile.username)}`}
              className="inline-flex items-center gap-1.5 underline"
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
            {log.logged_at.slice(0, 10)}
          </span>
        </p>
        <Stars rating={log.rating} />
      </div>
    </div>
  );

  // The part the owner can edit
  const body = (
    <>
      {log.review && (
        <p className="whitespace-pre-wrap">
          <ReviewText text={log.review} />
        </p>
      )}
    </>
  );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <article className="card flex flex-col gap-3 p-4">
        {isOwner ? (
          <OwnerControls
            logId={log.id}
            rating={log.rating === null ? null : Number(log.rating)}
            review={log.review}
            profileHref={`/u/${encodeURIComponent(profile.username)}`}
            header={header}
            body={body}
          />
        ) : (
          <>
            {header}
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
          initialCount={log.shares?.[0]?.count ?? 0}
          initiallyShared={viewer.sharedLogs.has(log.id)}
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
      />

      <Comments
        comments={comments}
        viewerId={viewerId ?? null}
        table="comments"
        scope={{ log_id: log.id }}
        ownerId={profile.id}
        likeable
      />
    </main>
  );
}
