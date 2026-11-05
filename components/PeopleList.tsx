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

  const [followersRes, followingRes] = await Promise.all([
    supabase
      .from("follows")
      .select("follower_id", { count: "exact" })
      .eq("following_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(MAX_PEOPLE),
    supabase
      .from("follows")
      .select("following_id", { count: "exact" })
      .eq("follower_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(MAX_PEOPLE),
  ]);

  const followerIds = (
    (followersRes.data ?? []) as unknown as { follower_id: string }[]
  ).map((r) => r.follower_id);
  const followingIds = (
    (followingRes.data ?? []) as unknown as { following_id: string }[]
  ).map((r) => r.following_id);
  const followersTotal = followersRes.count ?? followerIds.length;
  const followingTotal = followingRes.count ?? followingIds.length;

  // One lookup for everyone on either list
  const allIds = [...new Set([...followerIds, ...followingIds])];
  const { data: personData } = allIds.length
    ? await supabase
        .from("profiles")
        .select("id, username, avatar_path")
        .in("id", allIds)
    : { data: [] };
  const byId = new Map(
    ((personData ?? []) as unknown as PersonRow[]).map((p) => [p.id, p]),
  );
  // Newest first, as the follows came back
  const peopleFor = (ids: string[]) =>
    ids.flatMap((id) => {
      const person = byId.get(id);
      return person ? [person] : [];
    });

  const adminIds = await getAdminIds();
  const profileHref = `/u/${encodeURIComponent(profile.username)}`;

  const renderPeople = (people: PersonRow[], total: number, empty: string) =>
    people.length === 0 ? (
      <p className="text-center text-muted">{empty}</p>
    ) : (
      <>
        <ul className="mx-auto flex w-full max-w-[10rem] flex-col ">
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
              peopleFor(followerIds),
              followersTotal,
              "No followers yet.",
            ),
          },
          {
            id: "following",
            label: `${followingTotal} following`,
            content: renderPeople(
              peopleFor(followingIds),
              followingTotal,
              "Not following anyone yet.",
            ),
          },
        ]}
      />
    </main>
  );
}
