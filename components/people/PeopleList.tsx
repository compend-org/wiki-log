// ABOUTME: A person's followers and the people they follow, as two tabs.
// ABOUTME: Both lists are newest first and load together with the page.

import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import AdminBadge from "@/components/moderation/AdminBadge";
import Avatar from "@/components/people/Avatar";
import FollowButton from "@/components/people/FollowButton";
import PeopleTabs from "@/components/people/PeopleTabs";
import { getAdminIds } from "@/lib/admin/admin";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, isValidName } from "@/lib/username";

// More than this in one list and it would need paging
const MAX_PEOPLE = 200;

type PersonRow = { id: string; username: string; avatar_path: string | null };
type FollowState = {
  following: boolean;
  follows_you: boolean;
  blocked: boolean;
};

export default async function PeopleList({
  rawName,
  initial,
}: {
  rawName: string;
  initial: "followers" | "following";
}) {
  const t = await getTranslations();
  await connection();

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

  // Each follow comes with the person on the other end of it, so their ids
  // never have to be sent back in a second request (hundreds of them would
  // make its URL too long)
  const [followersRes, followingRes] = await Promise.all([
    supabase
      .from("follows")
      .select(
        "person:profiles!follows_follower_id_fkey(id, username, avatar_path)",
        { count: "exact" },
      )
      .eq("following_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(MAX_PEOPLE),
    supabase
      .from("follows")
      .select(
        "person:profiles!follows_following_id_fkey(id, username, avatar_path)",
        { count: "exact" },
      )
      .eq("follower_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(MAX_PEOPLE),
  ]);

  // Newest first, as the follows came back
  const peopleOf = (rows: unknown[] | null) =>
    ((rows ?? []) as { person: PersonRow | null }[]).flatMap((r) =>
      r.person ? [r.person] : [],
    );
  const followers = peopleOf(followersRes.data);
  const following = peopleOf(followingRes.data);
  const followersTotal = followersRes.count ?? followers.length;
  const followingTotal = followingRes.count ?? following.length;

  // How the viewer stands with each person listed, for the follow buttons
  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId: string | undefined = claimsData?.claims?.sub;
  const states = new Map<string, FollowState>();
  if (viewerId) {
    const ids = [...new Set([...followers, ...following].map((p) => p.id))];
    const { data } = await supabase.rpc("follow_states", { p_ids: ids });
    for (const row of (data ?? []) as (FollowState & { id: string })[])
      states.set(row.id, row);
  }

  const adminIds = await getAdminIds();
  const profileHref = `/u/${encodeURIComponent(profile.username)}`;

  const renderPeople = (people: PersonRow[], total: number, empty: string) =>
    people.length === 0 ? (
      <p className="text-center text-muted">{empty}</p>
    ) : (
      <>
        <ul className="flex w-full flex-col">
          {people.map((p) => (
            <li
              key={p.id}
              className="my-1 flex items-center gap-2 border-2 border-dashed border-line pr-2 hover:bg-surface"
            >
              <Link
                href={`/u/${encodeURIComponent(p.username)}`}
                className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 no-underline"
              >
                <Avatar name={p.username} path={p.avatar_path} size={40} />
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{p.username}</span>
                  {adminIds.has(p.id) && <AdminBadge />}
                </span>
              </Link>
              {viewerId && p.id !== viewerId && !states.get(p.id)?.blocked && (
                <FollowButton
                  viewerId={viewerId}
                  targetId={p.id}
                  following={states.get(p.id)?.following ?? false}
                  followsViewer={states.get(p.id)?.follows_you ?? false}
                  compact
                />
              )}
            </li>
          ))}
        </ul>
        {total > people.length && (
          <p className="mt-2 text-center text-sm text-muted">
            {t("people.list.showingRecent", { shown: people.length, total })}
          </p>
        )}
      </>
    );

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-2">
        <Link href={profileHref} className="text-sm text-muted hover:underline">
          ← {profile.username}
        </Link>
        <h1 className="text-3xl font-bold">
          {t("people.list.followersAndFollowing")}
        </h1>
      </header>

      <PeopleTabs
        initial={initial}
        tabs={[
          {
            id: "followers",
            label: `${followersTotal} ${followersTotal === 1 ? "follower" : "followers"}`,
            content: renderPeople(
              followers,
              followersTotal,
              t("people.list.noFollowers"),
            ),
          },
          {
            id: "following",
            label: t("profile.followingCount", { count: followingTotal }),
            content: renderPeople(
              following,
              followingTotal,
              t("people.list.noFollowing"),
            ),
          },
        ]}
      />
    </main>
  );
}
