// ABOUTME: Every review a person wrote with one rating, as cards that load as you scroll.
// ABOUTME: Reached by clicking a bar of the ratings histogram on their profile.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { loadMoreProfileRated } from "@/app/profileActions";
import CardPages from "@/components/CardPages";
import { loadProfilePage } from "@/components/loadProfilePage";
import { pageMetadata } from "@/lib/metadata";
import { getProfileByName } from "@/lib/profiles";
import { parseRatingStep, starText } from "@/lib/ratingHistogram";

export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; rating: string }>;
}): Promise<Metadata> {
  await connection();
  const { username, rating: raw } = await params;
  const rating = parseRatingStep(raw);
  if (rating === null) return {};
  const profile = await getProfileByName(username);
  if (!profile) return {};
  return pageMetadata({
    title: `${profile.username}'s ${starText(rating)} reviews`,
  });
}

export default async function RatedProfileReviewsPage({
  params,
}: {
  params: Promise<{ username: string; rating: string }>;
}) {
  await connection();
  const { username, rating: raw } = await params;
  const rating = parseRatingStep(raw);
  if (rating === null) notFound();
  const profile = await getProfileByName(username);
  if (!profile) notFound();

  const first = await loadProfilePage(profile.id, "reviews", null, rating);

  return (
    <main className="@container mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <Link
        href={`/u/${encodeURIComponent(profile.username)}`}
        className="text-sm text-muted"
      >
        ‹ Back to {profile.username}
      </Link>
      <h1 className="text-xl font-bold">
        <span className="text-star">{starText(rating)}</span> reviews by{" "}
        {profile.username}
      </h1>
      {first.cards.length === 0 && !first.next && !first.error && (
        <p className="text-muted">Nothing here yet.</p>
      )}
      <CardPages
        first={first}
        loadMore={loadMoreProfileRated.bind(null, profile.id, String(rating))}
      />
    </main>
  );
}