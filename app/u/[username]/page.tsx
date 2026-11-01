import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { USE_STUB } from "@/lib/video";
import { escapeLike, isValidName } from "@/lib/username";
import { commentLabel } from "@/lib/format";
import FollowButton from "@/components/FollowButton";
import Favourites, { type Slot } from "@/components/Favourites";
import Stars from "@/components/Stars";

export const instant = false;

type LogRow = {
  video_id: string;
  rating: number;
  review: string;
  logged_at: string;
  videos: { title: string } | null;
  comments: { count: number }[];
};

type FavRow = {
  position: number;
  video_id: string;
  videos: { title: string } | null;
};

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  await connection();
  const { username: rawName } = await params;

  let name = rawName;
  try {
    name = decodeURIComponent(rawName);
  } catch {}
  if (!isValidName(name)) notFound();

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username")
    .ilike("username", escapeLike(name))
    .maybeSingle();
  if (!profile) notFound();

  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId: string | undefined = claimsData?.claims?.sub;

  const [logsRes, followersRes, followingRes, isFollowingRes, favRes] =
    await Promise.all([
      supabase
        .from("logs")
        .select(
          "video_id, rating, review, logged_at, videos(title), comments(count)"
        )
        .eq("user_id", profile.id)
        .order("logged_at", { ascending: false }),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profile.id),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profile.id),
      viewerId
        ? supabase
            .from("follows")
            .select("follower_id")
            .eq("follower_id", viewerId)
            .eq("following_id", profile.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("favourites")
        .select("position, video_id, videos(title)")
        .eq("user_id", profile.id),
    ]);

  const logs = (logsRes.data ?? []) as unknown as LogRow[];
  const followers = followersRes.count ?? 0;
  const following = followingRes.count ?? 0;
  const isFollowing = Boolean(isFollowingRes.data);

  const favRows = (favRes.data ?? []) as unknown as FavRow[];
  const slots: (Slot | null)[] = [1, 2, 3, 4, 5].map((pos) => {
    const row = favRows.find((r) => r.position === pos);
    return row
      ? { videoId: row.video_id, title: row.videos?.title ?? "Unknown video" }
      : null;
  });

  const isOwner = viewerId === profile.id;
  const profileHref = `/u/${encodeURIComponent(profile.username)}`;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{profile.username}</h1>
        <p className="text-sm text-muted">
          {followers} {followers === 1 ? "follower" : "followers"} · {following}{" "}
          following · {logs.length} {logs.length === 1 ? "log" : "logs"}
        </p>
        <div className="mt-2">
          {!viewerId ? (
            <Link href="/login" className="underline">
              Sign in to follow
            </Link>
          ) : isOwner ? (
            <Link href="/settings" className="underline">
              Edit profile
            </Link>
          ) : (
            <FollowButton
              viewerId={viewerId}
              targetId={profile.id}
              initiallyFollowing={isFollowing}
            />
          )}
        </div>
      </header>

      {(isOwner || slots.some(Boolean)) && (
        <Favourites slots={slots} isOwner={isOwner} />
      )}

      {logs.length === 0 && <p className="text-muted">Nothing logged yet.</p>}

      {logs.map((log) => {
        const title = log.videos?.title ?? "Unknown video";
        const commentCount = log.comments?.[0]?.count ?? 0;
        return (
          <Link
            key={log.video_id}
            href={`${profileHref}/${log.video_id}`}
            className="card flex gap-4 p-3"
          >
            {USE_STUB ? (
              <div className="aspect-video w-32 shrink-0 rounded bg-surface" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://i.ytimg.com/vi/${log.video_id}/mqdefault.jpg`}
                alt={title}
                className="aspect-video w-32 shrink-0 rounded object-cover"
              />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-semibold">{title}</span>
              <Stars rating={log.rating} />
              {log.review && <p className="text-sm">{log.review}</p>}
              <span className="text-xs text-muted">
                {new Date(log.logged_at).toLocaleDateString()}
                {commentCount > 0 && <> · {commentLabel(commentCount)}</>}
              </span>
            </div>
          </Link>
        );
      })}
    </main>
  );
}