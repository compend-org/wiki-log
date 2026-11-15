// ABOUTME: Every list, review or pin a person has made, as cards that load as you scroll.
// ABOUTME: Reached by clicking the Lists, Reviews or Pinned heading on their profile.
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { loadMorePinned, loadMoreProfileAll } from "@/app/profileActions";
import CardPages, { type CardsPage } from "@/components/paging/CardPages";
import {
  loadPinnedPage,
  loadProfilePage,
  type ProfileKind,
} from "@/components/profile/loadProfilePage";
import { getProfileByName } from "@/lib/profiles";

export default async function ProfileAll({
  username,
  kind,
}: {
  username: string;
  kind: ProfileKind | "pinned";
}) {
  await connection();
  const profile = await getProfileByName(username);
  if (!profile) notFound();

  const title = { lists: "Lists", reviews: "Reviews", pinned: "Pinned" }[kind];
  const cards =
    kind === "pinned" ? (
      <PinnedCards profileId={profile.id} />
    ) : (
      <ProfileCards profileId={profile.id} kind={kind} />
    );

  return (
    <main className="@container mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <Link
        href={`/u/${encodeURIComponent(profile.username)}`}
        className="text-sm text-muted"
      >
        ‹ Back to {profile.username}
      </Link>
      <h1 className="text-xl font-bold">
        {title} by {profile.username}
      </h1>
      {cards}
    </main>
  );
}

function NothingYet({ page }: { page: CardsPage<unknown> }) {
  return page.cards.length === 0 && !page.next && !page.error ? (
    <p className="text-muted">Nothing here yet.</p>
  ) : null;
}

async function ProfileCards({
  profileId,
  kind,
}: {
  profileId: string;
  kind: ProfileKind;
}) {
  const first = await loadProfilePage(profileId, kind, null, undefined, true);
  return (
    <>
      <NothingYet page={first} />
      <CardPages
        first={first}
        loadMore={loadMoreProfileAll.bind(null, profileId, kind)}
      />
    </>
  );
}

async function PinnedCards({ profileId }: { profileId: string }) {
  const first = await loadPinnedPage(profileId, null);
  return (
    <>
      <NothingYet page={first} />
      <CardPages
        first={first}
        loadMore={loadMorePinned.bind(null, profileId)}
      />
    </>
  );
}
