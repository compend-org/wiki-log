// ABOUTME: A person's public profile: their details, favourites, lists and reviews.
// ABOUTME: Also holds the follow, block and ban controls for whoever is viewing it.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import AdminBadge from "@/components/AdminBadge";
import Avatar from "@/components/Avatar";
import BanButton from "@/components/BanButton";
import BlockButton from "@/components/BlockButton";
import Favourites, { type Slot } from "@/components/Favourites";
import FollowButton from "@/components/FollowButton";
import ItemImage from "@/components/ItemImage";
import ListPreview from "@/components/ListPreview";
import ReviewText from "@/components/ReviewText";
import SignOutButton from "@/components/SignOutButton";
import Stars from "@/components/Stars";
import { isAdmin } from "@/lib/admin";
import { avatarUrl } from "@/lib/avatar";
import { commentLabel } from "@/lib/format";
import { pageMetadata } from "@/lib/metadata";
import { getProfileByName } from "@/lib/profiles";
import { loginHref } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type ItemInfo = { title: string; image_url: string | null } | null;

type LogRow = {
  id: string;
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

type ListRow = {
  id: string;
  title: string;
  ranked: boolean;
  list_items: { count: number }[];
};

type PreviewRow = {
  list_id: string;
  position: number;
  items: ItemInfo;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  await connection();
  const { username } = await params;
  const profile = await getProfileByName(username);
  if (!profile) return {};

  return pageMetadata({
    title: profile.username,
    image: avatarUrl(profile.avatar_path),
    squareImage: true,
  });
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  await connection();
  const { username: rawName } = await params;

  const profile = await getProfileByName(rawName);
  if (!profile) notFound();

  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId: string | undefined = claimsData?.claims?.sub;

  const [
    logsRes,
    followersRes,
    followingRes,
    isFollowingRes,
    favRes,
    listsRes,
    isBlockedRes,
    logCountRes,
    listCountRes,
  ] = await Promise.all([
    supabase
      .from("logs")
      .select(
        "id, item_id, rating, review, logged_at, items(title, image_url), comments(count)",
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
    supabase
      .from("lists")
      .select("id, title, ranked, list_items(count)")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false }),
    viewerId
      ? supabase
          .from("blocks")
          .select("blocked_id")
          .eq("blocker_id", viewerId)
          .eq("blocked_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.id),
    supabase
      .from("lists")
      .select("*", { count: "exact", head: true })
      .eq("user_id", profile.id),
  ]);

  const logs = (logsRes.data ?? []) as unknown as LogRow[];
  const followers = followersRes.count ?? 0;
  const following = followingRes.count ?? 0;
  const logCount = logCountRes.count ?? 0;
  const listCount = listCountRes.count ?? 0;
  const isFollowing = Boolean(isFollowingRes.data);
  const isBlocked = Boolean(isBlockedRes.data);

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

  // The first four items of each list, for the preview thumbnails
  const lists = (listsRes.data ?? []) as unknown as ListRow[];
  const previews = new Map<
    string,
    { title: string; image_url: string | null }[]
  >();
  if (lists.length > 0) {
    const { data: previewData } = await supabase
      .from("list_items")
      .select("list_id, position, items(title, image_url)")
      .in(
        "list_id",
        lists.map((l) => l.id),
      )
      .lte("position", 4)
      .order("position");
    for (const row of (previewData ?? []) as unknown as PreviewRow[]) {
      const entries = previews.get(row.list_id) ?? [];
      entries.push({
        title: row.items?.title ?? "Unknown item",
        image_url: row.items?.image_url ?? null,
      });
      previews.set(row.list_id, entries);
    }
  }

  const isOwner = viewerId === profile.id;
  const profileIsAdmin = await isAdmin(profile.id);
  const viewerIsAdmin = await isAdmin(viewerId);
  const profileHref = `/u/${encodeURIComponent(profile.username)}`;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-4">
          <Avatar
            name={profile.username}
            path={profile.avatar_path}
            size={72}
          />
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="break-words text-3xl font-bold">
              {profile.username}
            </h1>
            {profileIsAdmin && <AdminBadge />}
          </div>
        </div>
        <p className="text-sm text-muted">
          <Link
            href={`${profileHref}/connections?tab=followers`}
            className="hover:underline"
          >
            {followers} {followers === 1 ? "follower" : "followers"}
          </Link>{" "}
          ·{" "}
          <Link
            href={`${profileHref}/connections?tab=following`}
            className="hover:underline"
          >
            {following} following
          </Link>{" "}
          · {logCount} {logCount === 1 ? "log" : "logs"} · {listCount}{" "}
          {listCount === 1 ? "list" : "lists"}
        </p>
        {profile.bio && (
          <p className="mt-2 max-w-prose whitespace-pre-wrap break-words">
            {profile.bio}
          </p>
        )}
        <div className="mt-2 flex items-center gap-4">
          {!viewerId ? (
            <Link href={loginHref(profileHref)} className="underline">
              Sign in to follow
            </Link>
          ) : isOwner ? (
            <div className="flex items-center gap-4">
              <Link href="/settings" className="underline">
                Profile settings
              </Link>
              <SignOutButton className="inline-flex sm:hidden" />
            </div>
          ) : (
            <div className="flex items-start gap-3">
              {/* Nobody can follow someone they have blocked */}
              {!isBlocked && (
                <FollowButton
                  viewerId={viewerId}
                  targetId={profile.id}
                  initiallyFollowing={isFollowing}
                />
              )}
              <BlockButton
                viewerId={viewerId}
                targetId={profile.id}
                targetName={profile.username}
                initiallyBlocked={isBlocked}
              />
            </div>
          )}
          {viewerIsAdmin && !profileIsAdmin && (
            <BanButton
              userId={profile.id}
              username={profile.username}
              redirectTo="/"
            />
          )}
        </div>
      </header>

      {(isOwner || slots.some(Boolean)) && (
        <Favourites slots={slots} isOwner={isOwner} />
      )}

      {(isOwner || lists.length > 0) && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Lists
            </h2>
            {/* {isOwner && (
              <Link href="/list/new" className="text-sm underline">
                New list
              </Link>
            )} */}
          </div>
          {lists.length === 0 && <p className="text-muted">No lists yet.</p>}
          {lists.map((l) => {
            const count = l.list_items?.[0]?.count ?? 0;
            const preview = previews.get(l.id) ?? [];
            return (
              <div
                key={l.id}
                className="card relative flex flex-col gap-2 p-3 hover:bg-surface"
              >
                <Link
                  href={`/list/${l.id}`}
                  aria-label={`Open the list ${l.title}`}
                  className="absolute inset-0 rounded-[inherit]"
                />
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{l.title}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {l.ranked ? "Ranked · " : ""}
                    {count} {count === 1 ? "item" : "items"}
                  </span>
                </div>
                {preview.length > 0 && (
                  <ListPreview
                    thumbs={preview}
                    total={count}
                    href={`/list/${l.id}`}
                  />
                )}
              </div>
            );
          })}
        </section>
      )}
      {logs.length > 0 && (
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Reviews
        </h2>
      )}

      {logs.length === 0 && <p className="text-muted">Nothing logged yet.</p>}

      {logs.map((log) => {
        const title = log.items?.title ?? "Unknown item";
        const commentCount = log.comments?.[0]?.count ?? 0;
        return (
          <div
            key={log.id}
            className="card relative flex gap-4 p-3 hover:bg-surface"
          >
            <Link
              href={`${profileHref}/${log.id}`}
              aria-label={`Open the review of ${title}`}
              className="absolute inset-0 rounded-[inherit]"
            />
            <ItemImage
              src={log.items?.image_url}
              alt={title}
              className="h-20 w-20 shrink-0 rounded"
            />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-semibold">{title}</span>
              <Stars rating={log.rating} />
              {log.review && (
                <p className="text-sm">
                  <ReviewText text={log.review} />
                </p>
              )}
              <span className="text-xs text-muted">
                {new Date(log.logged_at).toLocaleDateString()}
                {commentCount > 0 && <> · {commentLabel(commentCount)}</>}
              </span>
            </div>
          </div>
        );
      })}
    </main>
  );
}
