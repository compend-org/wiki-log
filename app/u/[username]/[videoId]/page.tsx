import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { USE_STUB } from "@/lib/video";
import { escapeLike, isValidName } from "@/lib/username";
import { getLikedSet, likeKey } from "@/lib/likes";
import LikeButton from "@/components/LikeButton";
import Comments, { type CommentItem } from "@/components/Comments";
import Stars from "@/components/Stars";

export const instant = false;

type LogRow = {
  user_id: string;
  video_id: string;
  rating: number;
  review: string;
  logged_at: string;
  videos: { title: string } | null;
  likes: { count: number }[];
};

type CommentQueryRow = {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  user_id: string;
  profiles: { username: string } | null;
};

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ username: string; videoId: string }>;
}) {
  await connection();
  const { username: rawName, videoId } = await params;

  let name = rawName;
  try {
    name = decodeURIComponent(rawName);
  } catch { }
  if (!isValidName(name) || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) notFound();

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
    .select("user_id, video_id, rating, review, logged_at, videos(title), likes(count)")
    .eq("user_id", profile.id)
    .eq("video_id", videoId)
    .maybeSingle();
  if (!logData) notFound();
  const log = logData as unknown as LogRow;

  const { data: commentData } = await supabase
    .from("comments")
    .select(
      "id, parent_id, body, created_at, user_id, profiles!comments_user_id_profiles_fkey(username)"
    )
    .eq("log_user_id", profile.id)
    .eq("log_video_id", videoId)
    .order("created_at", { ascending: true });

  const comments: CommentItem[] = (
    (commentData ?? []) as unknown as CommentQueryRow[]
  ).map((c) => ({
    id: c.id,
    parentId: c.parent_id,
    body: c.body,
    date: c.created_at.slice(0, 10),
    authorId: c.user_id,
    authorName: c.profiles?.username ?? "Someone",
  }));

  const likedSet = await getLikedSet(supabase, viewerId, [log]);
  const title = log.videos?.title ?? "Unknown video";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <article className="flex flex-col gap-3 rounded-lg border border-line p-4">
        <Link href={`/video/${videoId}`} className="block">
          {USE_STUB ? (
            <div className="aspect-video w-full rounded bg-surface" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt={title}
              className="aspect-video w-full rounded object-cover"
            />
          )}
        </Link>
        <Link href={`/video/${videoId}`} className="text-xl font-bold">
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
        {log.review && <p className="whitespace-pre-wrap">{log.review}</p>}
        {log.review && (
          <div>
            <LikeButton
              viewerId={viewerId ?? null}
              authorId={log.user_id}
              videoId={log.video_id}
              initialCount={log.likes?.[0]?.count ?? 0}
              initiallyLiked={likedSet.has(likeKey(log.user_id, log.video_id))}
            />
          </div>
        )}
      </article>

      <Comments
        comments={comments}
        viewerId={viewerId ?? null}
        logUserId={profile.id}
        logVideoId={videoId}
      />
    </main>
  );
}