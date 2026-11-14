// ABOUTME: Every list or every review a person has made, as cards that load as you scroll.
// ABOUTME: Reached by clicking the Lists or Reviews heading on their profile.
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { loadMoreProfileAll } from "@/app/profileActions";
import CardPages from "@/components/CardPages";
import {
  loadProfilePage,
  type ProfileKind,
} from "@/components/loadProfilePage";
import { getProfileByName } from "@/lib/profiles";

export default async function ProfileAll({
  username,
  kind,
}: {
  username: string;
  kind: ProfileKind;
}) {
  await connection();
  const profile = await getProfileByName(username);
  if (!profile) notFound();

  const first = await loadProfilePage(profile.id, kind, null, undefined, true);

  return (
    <main className="@container mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <Link
        href={`/u/${encodeURIComponent(profile.username)}`}
        className="text-sm text-muted"
      >
        ‹ Back to {profile.username}
      </Link>
      <h1 className="text-xl font-bold">
        {kind === "lists" ? "Lists" : "Reviews"} by {profile.username}
      </h1>
      {first.cards.length === 0 && !first.next && !first.error && (
        <p className="text-muted">Nothing here yet.</p>
      )}
      <CardPages
        first={first}
        loadMore={loadMoreProfileAll.bind(null, profile.id, kind)}
      />
    </main>
  );
}
