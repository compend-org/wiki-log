import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, isValidName } from "@/lib/username";
import { isUuid } from "@/lib/ids";
import { getLikedSet, likeKey } from "@/lib/likes";
import { getAlsoLiked } from "@/lib/alsoLiked";
import Avatar from "@/components/Avatar";
import LikeButton from "@/components/LikeButton";
import AlsoLiked from "@/components/AlsoLiked";
import Comments, { type CommentItem } from "@/components/Comments";
import ItemImage from "@/components/ItemImage";
import Stars from "@/components/Stars";
import OwnerControls from "@/components/OwnerControls";
import { isAdmin } from "@/lib/admin";
import AdminBadge from "@/components/AdminBadge";

export const instant = false;

type LogRow = {
  id: string;
  user_id: string;
  item_id: string;
  rating: number | null;
  review: string;
  logged_at: string;
  items: { title: string; image_url: string | null } | null;
  likes: { count: number }[];
};

type CommentQueryRow = {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  user_id: string;
  profiles: { username: string } | null;
  comment_likes: { count: number }[];
};

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ username: string; logId: string }>;
}) {
  await connection();
  const { username: rawName, logId } = await params;

  let name = rawName;
  try {
    name = decodeURIComponent(rawName);
  } catch { }
  if (!isValidName(name)) notFound();

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, avatar_path")
    .ilike("username", escapeLike(name))
    .maybeSingle();
  if (!profile) notFound();

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

  const { data: logData } = await supabase
    .from("logs")
    .select(
      "id, user_id, item_id, rating, review, logged_at, items(title, image_url), likes(count)"
    )
    .eq("id", logId)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!logData) notFound();
  const log = logData as unknown as LogRow;

  const { data: commentData } = await supabase
    .from("comments")
    .select(
      "id, parent_id, body, created_at, user_id, profiles!comments_user_id_profiles_fkey(username), comment_likes(count)"
    )
    .eq("log_id", log.id)
    .order("created_at", { ascending: true });

  const commentRows = (commentData ?? []) as unknown as CommentQueryRow[];

  // Which of these comments has the viewer already liked?
  let likedCommentIds = new Set<string>();
  if (viewerId && commentRows.length > 0) {
    const { data: likedRows } = await supabase
      .from("comment_likes")
      .select("comment_id")
      .eq("user_id", viewerId)
      .in(
        "comment_id",
        commentRows.map((c) => c.id)
      );
    likedCommentIds = new Set((likedRows ?? []).map((r) => r.comment_id));
  }

  const comments: CommentItem[] = commentRows.map((c) => ({
    id: c.id,
    parentId: c.parent_id,
    body: c.body,
    date: c.created_at.slice(0, 10),
    authorId: c.user_id,
    authorName: c.profiles?.username ?? "Someone",
    likeCount: c.comment_likes?.[0]?.count ?? 0,
    liked: likedCommentIds.has(c.id),
  }));

  const likedSet = await getLikedSet(supabase, viewerId, [log]);
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
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
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
          {isAdmin(log.user_id) && <AdminBadge />}
          <span>· {log.logged_at.slice(0, 10)}</span>

        </p>
        <Stars rating={log.rating} />
      </div>
    </div>
  );

  // The part the owner can edit
  const body = (
    <>
      {log.review && <p className="whitespace-pre-wrap">{log.review}</p>}
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

      <div>
        <LikeButton
          viewerId={viewerId ?? null}
          authorId={log.user_id}
          logId={log.id}
          initialCount={log.likes?.[0]?.count ?? 0}
          initiallyLiked={likedSet.has(log.id)}
        />
      </div>

      <AlsoLiked
        username = {profile.username}
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