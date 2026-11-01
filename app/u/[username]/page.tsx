import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, isValidName } from "@/lib/username";
import { commentLabel } from "@/lib/format";
import FollowButton from "@/components/FollowButton";
import Favourites, { type Slot } from "@/components/Favourites";
import ItemImage from "@/components/ItemImage";
import Stars from "@/components/Stars";

export const instant = false;

type ItemInfo = { title: string; image_url: string | null } | null;

type LogRow = {
  item_id: string;
  rating: number;
  review: string;
  logged_at: string;
  items: ItemInfo;
  comments: { count: number }[];
};

type FavRow = {
  position: number;
  item_id: string;
  items: ItemInfo;
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
          "item_id, rating, review, logged_at, items(title, image_url), comments(count)"
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
        .select("position, item_id, items(title, image_url)")
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
      ? {
          itemId: row.item_id,
          title: row.items?.title ?? "Unknown item",
          imageUrl: row.items?.image_url ?? null,
        }
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
        const title = log.items?.title ?? "Unknown item";
        const commentCount = log.comments?.[0]?.count ?? 0;
        return (
          <Link
            key={log.item_id}
            href={`${profileHref}/${log.item_id}`}
            className="card flex gap-4 p-3"
          >
            <ItemImage
              src={log.items?.image_url}
              alt={title}
              className="h-20 w-20 shrink-0 rounded"
            />
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