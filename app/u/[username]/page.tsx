// ABOUTME: A person's public profile: their details, favourites, lists and reviews.
// ABOUTME: Also holds the follow, block, report and ban controls for whoever is viewing it.
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
import ListCard from "@/components/ListCard";
import LogCard from "@/components/LogCard";
import PinButton from "@/components/PinButton";
import ReportButton from "@/components/ReportButton";
import SignOutButton from "@/components/SignOutButton";
import { isAdmin } from "@/lib/admin";
import { avatarUrl } from "@/lib/avatar";
import type { ListRow as ListCardRow, LogRow } from "@/lib/feedData";
import { pageMetadata } from "@/lib/metadata";
import { getProfileByName } from "@/lib/profiles";
import { loginHref } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";
import { getViewerState } from "@/lib/viewerState";

export const instant = false;

type ItemInfo = { title: string; image_url: string | null } | null;

// The columns a review card needs, for both the review list and the pinned ones
const LOG_FIELDS =
  "id, user_id, item_id, rating, review, logged_at, items(title, image_url), profiles!logs_user_id_profiles_fkey(username, avatar_path), likes(count), comments(count), shares(count)";

// The columns a list card needs, with the first items of the list as preview
const LIST_FIELDS =
  "id, user_id, title, ranked, created_at, profiles!lists_user_id_profiles_fkey(username, avatar_path), list_items(count), list_likes(count), list_comments(count), shares(count), preview:list_items(position, items(title, image_url))";

type FavRow = {
  position: number;
  item_id: string;
  items: ItemInfo;
};

type ListRow = ListCardRow & {
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
  follows_viewer?: { following_id: string }[];
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
        `owned_lists:lists!lists_user_id_profiles_fkey(${LIST_FIELDS}), ` +
        `reviews:logs!logs_user_id_profiles_fkey(${LOG_FIELDS})` +
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
      ? supabase.from("logs").select(LOG_FIELDS).in("id", pinnedLogIds)
      : { data: [] },
    pinnedListIds.length > 0
      ? supabase
          .from("lists")
          .select(LIST_FIELDS)
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

  // What the viewer has liked and shared among the reviews and lists shown
  const viewer = await getViewerState(supabase, viewerId, {
    logIds: [...pinnedLogs.keys(), ...otherLogs.map((l) => l.id)],
    listIds: [...pinnedLists.keys(), ...otherLists.map((l) => l.id)],
  });

  const isOwner = viewerId === profile.id;
  // Only the owner can read their own suspension
  const { data: suspension } = isOwner
    ? await supabase
        .from("account_restrictions")
        .select("suspended_until")
        .gt("suspended_until", new Date().toISOString())
        .maybeSingle()
    : { data: null };
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

  const renderList = (l: ListRow, isPinned: boolean) => (
    <ListCard
      key={l.id}
      list={l}
      thumbs={l.preview.map((p) => ({
        title: p.items?.title ?? "Unknown item",
        image_url: p.items?.image_url ?? null,
      }))}
      viewerId={viewerId}
      liked={viewer.likedLists.has(l.id)}
      shared={viewer.sharedLists.has(l.id)}
      controls={pinControl("list", l.id, isPinned)}
    />
  );

  const renderLog = (log: LogRow, isPinned: boolean) => (
    <LogCard
      key={log.id}
      log={log}
      viewerId={viewerId}
      liked={viewer.likedLogs.has(log.id)}
      shared={viewer.sharedLogs.has(log.id)}
      controls={pinControl("log", log.id, isPinned)}
    />
  );

  return (
    <main className="@container mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      {suspension && (
        <p
          role="status"
          className="rounded-lg border border-danger px-4 py-3 text-sm text-danger"
        >
          Your account is suspended until{" "}
          {new Date(suspension.suspended_until).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
          .
        </p>
      )}
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
                  followsViewer={followsViewer}
                />
              )}
              <BlockButton
                viewerId={viewerId}
                targetId={profile.id}
                targetName={profile.username}
                initiallyBlocked={isBlocked}
              />
              <ReportButton
                viewerId={viewerId}
                ownerId={profile.id}
                kind="profile"
                targetId={profile.id}
                className="rounded-lg border border-line px-4 py-2 text-muted"
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
