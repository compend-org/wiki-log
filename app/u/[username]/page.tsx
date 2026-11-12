// ABOUTME: A person's public profile: their details, favourites, lists and reviews.
// ABOUTME: Also holds the follow, block, report and ban controls for whoever is viewing it.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { loadMoreProfile } from "@/app/profileActions";
import AdminBadge from "@/components/AdminBadge";
import Avatar from "@/components/Avatar";
import BanButton from "@/components/buttons/BanButton";
import BlockButton from "@/components/buttons/BlockButton";
import FollowButton from "@/components/buttons/FollowButton";
import ReportButton from "@/components/buttons/ReportButton";
import SignOutButton from "@/components/buttons/SignOutButton";
import CardPages, { type CardsPage } from "@/components/CardPages";
import Favourites, { type Slot } from "@/components/Favourites";
import SettingsIcon from "@/components/icons/SettingsIcon";
import {
  fetchProfileRows,
  LIST_FIELDS,
  LOG_FIELDS,
  type ProfileContext,
  type ProfileListRow,
  renderProfileCards,
  renderProfileList,
  renderProfileLog,
} from "@/components/loadProfilePage";
import RatingHistogram from "@/components/RatingsHistogram";
import { isAdmin } from "@/lib/admin";
import { avatarUrl } from "@/lib/avatar";
import type { LogRow } from "@/lib/feedData";
import { pageMetadata } from "@/lib/metadata";
import { getProfileByName } from "@/lib/profiles";
import { loginHref } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";
import { getViewerState } from "@/lib/viewerState";

export const instant = false;

type ItemInfo = { title: string; image_url: string | null } | null;

type FavRow = {
  position: number;
  item_id: string;
  items: ItemInfo;
};

type PinRow = {
  pinned_at: string;
  log_id: string | null;
  list_id: string | null;
};

type Pinned =
  | { kind: "log"; log: LogRow }
  | { kind: "list"; list: ProfileListRow };

type ProfileContent = {
  followers: { count: number }[];
  following: { count: number }[];
  log_count: { count: number }[];
  list_count: { count: number }[];
  favourites: FavRow[];
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

  // Everything else on the page but the lists and reviews in one request. The
  // embeds that get filtered or ordered have aliases of their own, because
  // PostgREST applies options like "logs.order" to the first embed of that
  // table, which could be a count. The viewer's follow and block are only
  // asked for when signed in. Lists and reviews are loaded a page at a time
  // below: someone can have more than one response holds.
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
        "pin_rows:pins(pinned_at, log_id, list_id)" +
        viewerEmbeds,
    )
    .eq("id", profile.id)
    .order("pinned_at", { referencedTable: "pin_rows", ascending: false });
  if (viewerId) {
    contentQuery = contentQuery
      .eq("viewer_follow.follower_id", viewerId)
      .eq("follows_viewer.following_id", viewerId)
      .eq("viewer_block.blocker_id", viewerId);
  }
  const { data: contentData } = await contentQuery.maybeSingle();
  const content = contentData as unknown as ProfileContent | null;

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

  // What they pinned, loaded on its own whatever page it would be on, and the
  // first page of their lists and of their reviews without the pinned ones
  const pinRows = content?.pin_rows ?? [];
  const pinnedLogIds = pinRows.flatMap((p) => (p.log_id ? [p.log_id] : []));
  const pinnedListIds = pinRows.flatMap((p) => (p.list_id ? [p.list_id] : []));
  const ctx: ProfileContext = {
    profileId: profile.id,
    viewerId,
    pinnedLogIds: new Set(pinnedLogIds),
    pinnedListIds: new Set(pinnedListIds),
  };
  // The lists and reviews below start again from the first page when the pins
  // change, since the pinned cards move out of them or back in
  const pinsKey = pinRows.map((p) => p.log_id ?? p.list_id).join(",");
  const [pinnedLogsRes, pinnedListsRes, listRows, logRows, ratingCountsRes] =
    await Promise.all([
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
      fetchProfileRows(supabase, ctx, "lists", null),
      fetchProfileRows(supabase, ctx, "reviews", null),
      supabase.rpc("profile_rating_counts", { p_user: profile.id }),
    ]);
  // One rating per item they rated, for the histogram
  const ratings = (
    (ratingCountsRes.data ?? []) as {
      step: number | string;
      n: number | string;
    }[]
  ).flatMap((r) => Array<number>(Number(r.n)).fill(Number(r.step)));
  const pinnedLogs = new Map(
    ((pinnedLogsRes.data ?? []) as unknown as LogRow[]).map((l) => [l.id, l]),
  );
  const pinnedLists = new Map(
    ((pinnedListsRes.data ?? []) as unknown as ProfileListRow[]).map((l) => [
      l.id,
      l,
    ]),
  );
  // Newest pin first. A pin whose log or list can't be found is left out.
  const pinned = pinRows.flatMap((p): Pinned[] => {
    const log = p.log_id ? pinnedLogs.get(p.log_id) : undefined;
    if (log) return [{ kind: "log", log }];
    const list = p.list_id ? pinnedLists.get(p.list_id) : undefined;
    return list ? [{ kind: "list", list }] : [];
  });

  // What the viewer has liked and shared among the reviews and lists shown
  const viewer = await getViewerState(supabase, viewerId, {
    logIds: [...pinnedLogs.keys(), ...logRows.rows.map((l) => l.id)],
    listIds: [...pinnedLists.keys(), ...listRows.rows.map((l) => l.id)],
  });
  const firstLists: CardsPage = {
    cards: renderProfileCards(ctx, viewer, "lists", listRows.rows),
    next: listRows.next,
    error: listRows.error,
  };
  const firstLogs: CardsPage = {
    cards: renderProfileCards(ctx, viewer, "reviews", logRows.rows),
    next: logRows.next,
    error: logRows.error,
  };

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
        <div className="flex min-w-0 items-center gap-4">
          <Avatar
            name={profile.username}
            path={profile.avatar_path}
            size={72}
          />
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <h1 className="break-words text-3xl font-bold">
              {profile.username}
            </h1>
            {profileIsAdmin && <AdminBadge />}
            {followsViewer && (
              <span className="ml-2 self-center rounded border border-line bg-surface px-2 py-0.5 text-xs text-muted">
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
        <div className="mt-2 flex items-center justify-between gap-4">
          <div className="mt-2 flex items-center gap-4">
            {!viewerId ? (
              <Link href={loginHref(profileHref)} className="underline">
                Sign in to follow
              </Link>
            ) : isOwner ? (
              <div className="flex items-center gap-4">
                <Link
                  href="/settings"
                  className="group inline-flex items-center gap-1.5"
                >
                  <SettingsIcon size={16} />
                  <span className="group-hover:underline">
                    Profile settings
                  </span>
                </Link>
                <SignOutButton
                  className="group inline-flex text-foreground! sm:hidden"
                  labelClassName="group-hover:underline"
                />
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
          <div className="hidden shrink-0 sm:block">
            <RatingHistogram
              ratings={ratings}
              highlight={null}
              unit={{ one: "rating", other: "ratings" }}
              compact
              hrefBase={`${profileHref}/ratings`}
            />
          </div>
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
              ? renderProfileLog(ctx, viewer, p.log, true)
              : renderProfileList(ctx, viewer, p.list, true),
          )}
        </section>
      )}
      {/* Hiding this for the time being because it is ugly on mobile */}
      {/* <div className="sm:hidden">
        <RatingHistogram
          ratings={ratings}
          highlight={null}
          unit={{ one: "rating", other: "ratings" }}
          hrefBase={`${profileHref}/ratings`}
        />
      </div> */}

      {(firstLists.cards.length > 0 ||
        firstLists.next ||
        firstLists.error ||
        (isOwner && listCount === 0)) && (
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
          {listCount === 0 && <p className="text-muted">No lists yet.</p>}
          <CardPages
            key={`lists:${pinsKey}:${listCount}`}
            first={firstLists}
            loadMore={loadMoreProfile.bind(null, profile.id, "lists")}
            moreButton="Show more lists"
          />
        </section>
      )}
      {(firstLogs.cards.length > 0 || firstLogs.next) && (
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Reviews
        </h2>
      )}

      {logCount === 0 && <p className="text-muted">Nothing logged yet.</p>}

      <CardPages
        key={`reviews:${pinsKey}:${logCount}`}
        first={firstLogs}
        loadMore={loadMoreProfile.bind(null, profile.id, "reviews")}
      />
    </main>
  );
}
