// ABOUTME: A person's followers and the people they follow, as two tabs.
// ABOUTME: Both lists are newest first and load together with the page.
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import AdminBadge from "@/components/AdminBadge";
import Avatar from "@/components/Avatar";
import PeopleTabs from "@/components/PeopleTabs";
import { getAdminIds } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, isValidName } from "@/lib/username";

// More than this in one list and it would need paging
const MAX_PEOPLE = 200;

type PersonRow = { id: string; username: string; avatar_path: string | null };

export default async function PeopleList({
  rawName,
  initial,
}: {
  rawName: string;
  initial: "followers" | "following";
}) {
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

  const adminIds = await getAdminIds();
  const profileHref = `/u/${encodeURIComponent(profile.username)}`;

  const renderPeople = (people: PersonRow[], total: number, empty: string) =>
    people.length === 0 ? (
      <p className="text-center text-muted">{empty}</p>
    ) : (
      <>
        <ul className="flex w-full flex-col">
          {people.map((p) => (
            <li key={p.id}>
              <Link
                href={`/u/${encodeURIComponent(p.username)}`}
                className="flex items-center gap-3 px-2 py-2 my-1 no-underline hover:bg-surface border-2 border-dashed border-line p-1"
              >
                <Avatar name={p.username} path={p.avatar_path} size={40} />
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{p.username}</span>
                  {adminIds.has(p.id) && <AdminBadge />}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {total > people.length && (
          <p className="mt-2 text-center text-sm text-muted">
            Showing the most recent {people.length} of {total}.
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
        <h1 className="text-3xl font-bold">Followers and following</h1>
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
              "No followers yet.",
            ),
          },
          {
            id: "following",
            label: `${followingTotal} following`,
            content: renderPeople(
              following,
              followingTotal,
              "Not following anyone yet.",
            ),
          },
        ]}
      />
    </main>
  );
}
