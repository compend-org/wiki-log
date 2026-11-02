import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, isValidName } from "@/lib/username";
import { getLikedSet, likeKey } from "@/lib/likes";
import { getAlsoLiked } from "@/lib/alsoLiked";
import LikeButton from "@/components/LikeButton";
import AlsoLiked from "@/components/AlsoLiked";
import Comments, { type CommentItem } from "@/components/Comments";
import ItemImage from "@/components/ItemImage";
import Stars from "@/components/Stars";

export const instant = false;

type LogRow = {
  user_id: string;
  item_id: string;
  rating: number;
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
  params: Promise<{ username: string; itemId: string }>;
}) {
  await connection();
  const { username: rawName, itemId } = await params;

  let name = rawName;
  try {
    name = decodeURIComponent(rawName);
  } catch {}
  if (!isValidName(name) || !/^Q\d+$/.test(itemId)) notFound();

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username")
    .ilike("username", escapeLike(name))
    .maybeSingle();
  if (!profile) notFound();

  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId: string | undefined = claimsData?.claims?.sub;

  const { data: logData } = await supabase
    .from("logs")
    .select(
      "user_id, item_id, rating, review, logged_at, items(title, image_url), likes(count)"
    )
    .eq("user_id", profile.id)
    .eq("item_id", itemId)
    .maybeSingle();
  if (!logData) notFound();
  const log = logData as unknown as LogRow;

  const { data: commentData } = await supabase
    .from("comments")
    .select(
      "id, parent_id, body, created_at, user_id, profiles!comments_user_id_profiles_fkey(username), comment_likes(count)"
    )
    .eq("log_user_id", profile.id)
    .eq("log_item_id", itemId)
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

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <article className="card flex flex-col gap-3 p-4">
        <div className="flex gap-4">
          <Link href={`/item/${itemId}`} className="shrink-0">
            <ItemImage
              src={log.items?.image_url}
              alt={title}
              className="h-28 w-28 rounded"
            />
          </Link>
          <div className="flex min-w-0 flex-col gap-1">
            <Link href={`/item/${itemId}`} className="text-xl font-bold">
              {title}
            </Link>
            <p className="text-sm text-muted">
              Review by{" "}
              <Link
                href={`/u/${encodeURIComponent(profile.username)}`}
                className="underline"
              >
                {profile.username}
              </Link>{" "}
              · {log.logged_at.slice(0, 10)}
            </p>
            <Stars rating={log.rating} />
          </div>
        </div>
        {log.review && <p className="whitespace-pre-wrap">{log.review}</p>}
        {log.review && (
          <div>
            <LikeButton
              viewerId={viewerId ?? null}
              authorId={log.user_id}
              itemId={log.item_id}
              initialCount={log.likes?.[0]?.count ?? 0}
              initiallyLiked={likedSet.has(likeKey(log.user_id, log.item_id))}
            />
          </div>
        )}
      </article>

      <AlsoLiked
        likes={alsoLiked.get(likeKey(log.user_id, log.item_id)) ?? []}
        itemId={itemId}
      />

      <Comments
        comments={comments}
        viewerId={viewerId ?? null}
        table="comments"
        scope={{ log_user_id: profile.id, log_item_id: itemId }}
        ownerId={profile.id}
        likeable
      />
    </main>
  );
}