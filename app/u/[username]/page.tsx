// ABOUTME: A person's public profile: their details, favourites, lists and reviews.
// ABOUTME: Also holds the follow, block, report and ban controls for whoever is viewing it.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { loadMoreProfile } from "@/app/profileActions";
import DiaryIcon from "@/components/activity/DiaryIcon";
import SignOutButton from "@/components/auth/SignOutButton";
import ItemImage from "@/components/items/ItemImage";
import RatingHistogram from "@/components/logs/RatingsHistogram";
import AdminBadge from "@/components/moderation/AdminBadge";
import BanButton from "@/components/moderation/BanButton";
import ReportButton from "@/components/moderation/ReportButton";
import CardPages, { type CardsPage } from "@/components/paging/CardPages";
import Avatar from "@/components/people/Avatar";
import BlockButton from "@/components/people/BlockButton";
import FollowButton from "@/components/people/FollowButton";
import Favourites, { type Slot } from "@/components/profile/Favourites";
import {
  fetchPinned,
  fetchProfileRows,
  type PinTarget,
  PROFILE_PAGE_SIZE_INITIAL,
  type ProfileContext,
  pinSets,
  renderPinnedCards,
  renderProfileCards,
} from "@/components/profile/loadProfilePage";
import PinnedSection, {
  type PinnedCard,
} from "@/components/profile/PinnedSection";
import SettingsIcon from "@/components/ui/SettingsIcon";
import { isAdmin } from "@/lib/admin/admin";
import { avatarUrl } from "@/lib/avatar";
import { getProfileCompounds } from "@/lib/craft/profileCompounds";
import { entryPicture } from "@/lib/format";
import { pageMetadata } from "@/lib/metadata";
import { getProfileByName } from "@/lib/profiles";
import { loginHref } from "@/lib/redirect";
import { SITE_NAME } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { getViewerState } from "@/lib/viewerState";

export const instant = false;

type ItemInfo = {
  title: string;
  image_url: string | null;
  nsfw: boolean;
} | null;

type FavRow = {
  position: number;
  item_id: string;
  // The picture its owner chose; null shows the item's
  image_url: string | null;
  items: ItemInfo;
};

type ProfileContent = {
  followers: { count: number }[];
  following: { count: number }[];
  log_count: { count: number }[];
  list_count: { count: number }[];
  favourites: FavRow[];
  pin_rows: (PinTarget & { id: string; position: number })[];
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

  const summary = `${profile.username}'s ratings, reviews and lists on ${SITE_NAME}.`;
  return pageMetadata({
    title: profile.username,
    description: profile.bio ? `${profile.bio} ${summary}` : summary,
    path: `/u/${encodeURIComponent(profile.username)}`,
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
        "favourites(position, item_id, image_url, items(title, image_url, nsfw)), " +
        "pin_rows:pins(id, position, log_id, list_id)" +
        viewerEmbeds,
    )
    .eq("id", profile.id)
    .order("position", { referencedTable: "pin_rows" })
    .order("id", { referencedTable: "pin_rows" });
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
          imageUrl: entryPicture(row),
          nsfw: row.items?.nsfw ?? false,
        }
      : null;
  });

  // The first of their pins, loaded on their own whatever page they would be
  // on, and the first page of their lists and of their reviews without those.
  // The owner gets every pin, to reorder them all.
  const isOwner = viewerId === profile.id;
  const pinRows = content?.pin_rows ?? [];
  const loadedPins = isOwner
    ? pinRows
    : pinRows.slice(0, PROFILE_PAGE_SIZE_INITIAL);
  const ctx: ProfileContext = {
    profileId: profile.id,
    viewerId,
    ...pinSets(pinRows),
  };
  // The lists and reviews below start again from the first page when the pins
  // change, since the pinned cards move out of them or back in
  const pinsKey = pinRows.map((p) => p.log_id ?? p.list_id).join(",");
  const [{ pinned }, listRows, logRows, ratingCountsRes, allCompounds] =
    await Promise.all([
      fetchPinned(supabase, loadedPins),
      fetchProfileRows(supabase, ctx, "lists", null),
      fetchProfileRows(supabase, ctx, "reviews", null),
      supabase.rpc("profile_rating_counts", { p_user: profile.id }),
      getProfileCompounds(supabase, profile.id),
    ]);
  // One rating per item they rated, for the histogram
  const ratings = (
    (ratingCountsRes.data ?? []) as {
      step: number | string;
      n: number | string;
    }[]
  ).flatMap((r) => Array<number>(Number(r.n)).fill(Number(r.step)));
  // What the viewer has liked and shared among the reviews and lists shown
  const viewer = await getViewerState(supabase, viewerId, {
    logIds: [
      ...pinned.flatMap((p) => (p.kind === "log" ? [p.log.id] : [])),
      ...logRows.rows.map((l) => l.id),
    ],
    listIds: [
      ...pinned.flatMap((p) => (p.kind === "list" ? [p.list.id] : [])),
      ...listRows.rows.map((l) => l.id),
    ],
  });
  // Compounds they crafted; adult ones are left out when the viewer hides them
  const compounds = allCompounds.filter(
    (c) => !(viewer.sfwMode === "hide" && c.nsfw),
  );
  // Each loaded pin with its card, which is null when the viewer hides it
  const pinnedCards = new Map(
    renderPinnedCards(ctx, viewer, pinned).map((c) => [c.key, c.card]),
  );
  const pins: PinnedCard[] = loadedPins.map((p) => ({
    id: p.id,
    card: pinnedCards.get(p.log_id ?? p.list_id ?? "") ?? null,
  }));
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
          <div className="mt-2 flex min-w-0 flex-1 flex-wrap items-center gap-4">
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
              <div className="flex items-start gap-2">
                {/* Nobody can follow someone they have blocked */}
                {!isBlocked && (
                  <Link
                    href={isOwner ? "/activity" : `${profileHref}/activity`}
                    className="rounded-lg border border-line px-4 py-2 text-muted hover:border-accent hover:text-foreground hover:no-underline"
                  >
                    <DiaryIcon />
                  </Link>
                )}
                {!isBlocked && (
                  <FollowButton
                    viewerId={viewerId}
                    targetId={profile.id}
                    following={isFollowing}
                    followsViewer={followsViewer}
                  />
                )}
                <BlockButton
                  viewerId={viewerId}
                  targetId={profile.id}
                  targetName={profile.username}
                  blocked={isBlocked}
                />
                <ReportButton
                  viewerId={viewerId}
                  ownerId={profile.id}
                  kind="profile"
                  targetId={profile.id}
                  className="rounded-lg border border-line px-4 py-2 text-muted hover:border-accent hover:text-foreground"
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
      {pins.length > 0 && (
        <PinnedSection
          profileHref={profileHref}
          pins={pins}
          shownCount={PROFILE_PAGE_SIZE_INITIAL}
          editable={isOwner}
        />
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
              <Link
                href={`${profileHref}/lists`}
                className="hover:text-foreground hover:underline"
              >
                Lists <span aria-hidden="true">›</span>
              </Link>
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
          <Link
            href={`${profileHref}/reviews`}
            className="hover:text-foreground hover:underline"
          >
            Reviews <span aria-hidden="true">›</span>
          </Link>
        </h2>
      )}

      {logCount === 0 && <p className="text-muted">Nothing logged yet.</p>}

      <CardPages
        key={`reviews:${pinsKey}:${logCount}`}
        first={firstLogs}
        loadMore={loadMoreProfile.bind(null, profile.id, "reviews")}
        moreButton="Show more reviews"
      />

      {compounds.length > 0 && (
        <section className="flex max-w-full flex-col gap-3 self-start ">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted ">
            Compounds
          </h2>
          <ul className="flex flex-wrap gap-3 rounded-lg border-2 border-dashed border-line p-3">
            {compounds.map((c) => (
              <li
                key={c.id}
                className="w-[calc((100cqw-53px)/3)] sm:w-[calc((100cqw-65px)/4)]"
              >
                <Link href={`/item/${c.id}`} className="flex flex-col gap-1">
                  <ItemImage
                    src={c.imageUrl}
                    nsfw={c.nsfw}
                    alt={c.title}
                    className="aspect-square w-full rounded-lg"
                  />
                  <span className="truncate text-xs">{c.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
