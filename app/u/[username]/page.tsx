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
import PinButton from "@/components/PinButton";
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
  preview: { position: number; items: ItemInfo }[];
};

type PinRow = {
  pinned_at: string;
  log_id: string | null;
  list_id: string | null;
};

type Pinned = { kind: "log"; log: LogRow } | { kind: "list"; list: ListRow };

// How many things a person can pin. The database enforces the same number.
const MAX_PINS = 3;

type ProfileContent = {
  followers: { count: number }[];
  following: { count: number }[];
  log_count: { count: number }[];
  list_count: { count: number }[];
  favourites: FavRow[];
  owned_lists: ListRow[];
  reviews: LogRow[];
  pin_rows: PinRow[];
  viewer_follow?: { follower_id: string }[];
  follows_viewer?: { follower_id: string }[];
  viewer_block?: { blocker_id: string }[];
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

  // Everything else on the page in one request. The embeds that get filtered,
  // ordered or limited have aliases of their own, because PostgREST applies
  // options like "logs.order" to the first embed of that table, which could be
  // a count. The viewer's follow and block are only asked for when signed in.
  const viewerEmbeds = viewerId
    ? ", viewer_follow:follows!follows_following_id_fkey(follower_id), follows_viewer:follows!follows_follower_id_fkey(following_id), viewer_block:blocks!blocks_blocked_id_fkey(blocker_id)"
    : "";
  let contentQuery = supabase
    .from("profiles")
    .select(
      "followers:follows!follows_following_id_fkey(count), " +
      "following:follows!follows_follower_id_fkey(count), " +
      "log_count:logs!logs_user_id_profiles_fkey(count), " +
      "list_count:lists!lists_user_id_profiles_fkey(count), " +
      "favourites(position, item_id, items(title, image_url)), " +
      "pin_rows:pins(pinned_at, log_id, list_id), " +
      "owned_lists:lists!lists_user_id_profiles_fkey(id, title, ranked, list_items(count), preview:list_items(position, items(title, image_url))), " +
      "reviews:logs!logs_user_id_profiles_fkey(id, item_id, rating, review, logged_at, items(title, image_url), comments(count))" +
      viewerEmbeds,
    )
    .eq("id", profile.id)
    .order("created_at", { referencedTable: "owned_lists", ascending: false })
    .order("pinned_at", { referencedTable: "pin_rows", ascending: false })
    // The first four items of each list, for the preview thumbnails
    .lte("owned_lists.preview.position", 4)
    .order("position", { referencedTable: "owned_lists.preview" })
    .order("logged_at", { referencedTable: "reviews", ascending: false })
    // Embedded rows aren't capped by the API's max_rows, so cap them the same way
    .limit(1000, { referencedTable: "reviews" });
  if (viewerId) {
    contentQuery = contentQuery
      .eq("viewer_follow.follower_id", viewerId)
      .eq("follows_viewer.following_id", viewerId)
      .eq("viewer_block.blocker_id", viewerId);
  }
  const { data: contentData } = await contentQuery.maybeSingle();
  const content = contentData as unknown as ProfileContent | null;

  const logs = content?.reviews ?? [];
  const followers = content?.followers[0]?.count ?? 0;
  const following = content?.following[0]?.count ?? 0;
  const logCount = content?.log_count[0]?.count ?? 0;
  const listCount = content?.list_count[0]?.count ?? 0;
  const isFollowing = Boolean(content?.viewer_follow?.length);
  const followsViewer = Boolean(content?.follows_viewer?.length);
  const isBlocked = Boolean(content?.viewer_block?.length);

  const favRows = content?.favourites ?? [];
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

  const lists = content?.owned_lists ?? [];

  // What they pinned: loaded on its own, so a pinned log older than the
  // newest 1000 still shows
  const pinRows = content?.pin_rows ?? [];
  const pinnedLogIds = pinRows.flatMap((p) => (p.log_id ? [p.log_id] : []));
  const pinnedListIds = pinRows.flatMap((p) => (p.list_id ? [p.list_id] : []));
  const [pinnedLogsRes, pinnedListsRes] = await Promise.all([
    pinnedLogIds.length > 0
      ? supabase
        .from("logs")
        .select(
          "id, item_id, rating, review, logged_at, items(title, image_url), comments(count)",
        )
        .in("id", pinnedLogIds)
      : { data: [] },
    pinnedListIds.length > 0
      ? supabase
        .from("lists")
        .select(
          "id, title, ranked, list_items(count), preview:list_items(position, items(title, image_url))",
        )
        .in("id", pinnedListIds)
        .lte("preview.position", 4)
        .order("position", { referencedTable: "preview" })
      : { data: [] },
  ]);
  const pinnedLogs = new Map(
    ((pinnedLogsRes.data ?? []) as unknown as LogRow[]).map((l) => [l.id, l]),
  );
  const pinnedLists = new Map(
    ((pinnedListsRes.data ?? []) as unknown as ListRow[]).map((l) => [l.id, l]),
  );
  // Newest pin first. A pin whose log or list can't be found is left out.
  const pinned = pinRows.flatMap((p): Pinned[] => {
    const log = p.log_id ? pinnedLogs.get(p.log_id) : undefined;
    if (log) return [{ kind: "log", log }];
    const list = p.list_id ? pinnedLists.get(p.list_id) : undefined;
    return list ? [{ kind: "list", list }] : [];
  });
  // Pinned things show at the top, so they aren't shown again below
  const otherLogs = logs.filter((l) => !pinnedLogs.has(l.id));
  const otherLists = lists.filter((l) => !pinnedLists.has(l.id));

  const isOwner = viewerId === profile.id;
  const profileIsAdmin = await isAdmin(profile.id);
  const viewerIsAdmin = await isAdmin(viewerId);
  const profileHref = `/u/${encodeURIComponent(profile.username)}`;

  // Pin and Unpin, on your own profile. Once you have 3 pins, only Unpin shows.
  const pinControl = (kind: "log" | "list", id: string, isPinned: boolean) =>
    isOwner && viewerId && (isPinned || pinRows.length < MAX_PINS) ? (
      <PinButton
        userId={viewerId}
        kind={kind}
        targetId={id}
        pinned={isPinned}
      />
    ) : null;

  const renderList = (l: ListRow, isPinned: boolean) => {
    const count = l.list_items?.[0]?.count ?? 0;
    const preview = l.preview.map((p) => ({
      title: p.items?.title ?? "Unknown item",
      image_url: p.items?.image_url ?? null,
    }));
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
          <span className="flex shrink-0 items-baseline gap-3 text-xs text-muted">
            <span>
              {l.ranked ? "Ranked · " : ""}
              {count} {count === 1 ? "item" : "items"}
            </span>
            {pinControl("list", l.id, isPinned)}
          </span>
        </div>
        {preview.length > 0 && (
          <ListPreview thumbs={preview} total={count} href={`/list/${l.id}`} />
        )}
      </div>
    );
  };

  const renderLog = (log: LogRow, isPinned: boolean) => {
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
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-semibold">{title}</span>
            <span className="shrink-0 text-xs text-muted">
              {pinControl("log", log.id, isPinned)}
            </span>
          </div>
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
  };

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
            {followsViewer && (
              <span className="ml-2 rounded border border-line bg-surface px-2 py-0.5 text-xs text-muted">
                Follows you
              </span>
            )}
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
      {pinned.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Pinned
          </h2>
          {pinned.map((p) =>
            p.kind === "log"
              ? renderLog(p.log, true)
              : renderList(p.list, true),
          )}
        </section>
      )}

      {(otherLists.length > 0 || (isOwner && lists.length === 0)) && (
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
          {otherLists.map((l) => renderList(l, false))}
        </section>
      )}
      {otherLogs.length > 0 && (
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Reviews
        </h2>
      )}

      {logs.length === 0 && <p className="text-muted">Nothing logged yet.</p>}

      {otherLogs.map((log) => renderLog(log, false))}
    </main>
  );
}
