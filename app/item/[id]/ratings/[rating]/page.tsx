// ABOUTME: Every review of an item that gave it one rating, as cards that load as you scroll.
// ABOUTME: Reached by clicking a bar of the ratings histogram on an item page.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { loadMoreRatedReviews } from "@/app/itemPagesActions";
import CardPages from "@/components/CardPages";
import { loadRatedReviewsPage } from "@/components/loadItemPages";
import { ITEM_ID_PATTERN } from "@/lib/ids";
import { pageMetadata } from "@/lib/metadata";
import { parseRatingStep, starText } from "@/lib/ratingHistogram";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

async function getTitle(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("title")
    .eq("id", id)
    .maybeSingle();
  return data?.title ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; rating: string }>;
}): Promise<Metadata> {
  await connection();
  const { id, rating: raw } = await params;
  const rating = parseRatingStep(raw);
  if (!ITEM_ID_PATTERN.test(id) || rating === null) return {};
  const title = await getTitle(id);
  if (!title) return {};
  return pageMetadata({ title: `${starText(rating)} reviews of ${title}` });
}

export default async function RatedReviewsPage({
  params,
}: {
  params: Promise<{ id: string; rating: string }>;
}) {
  await connection();
  const { id, rating: raw } = await params;
  const rating = parseRatingStep(raw);
  if (!ITEM_ID_PATTERN.test(id) || rating === null) notFound();
  const title = await getTitle(id);
  if (!title) notFound();

  const first = await loadRatedReviewsPage(id, rating, null);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <Link href={`/item/${id}`} className="text-sm text-muted">
        ‹ Back to {title}
      </Link>
      <h1 className="text-xl font-bold">
        <span className="text-star">{starText(rating)}</span> reviews of {title}
      </h1>
      {first.cards.length === 0 && !first.next && !first.error && (
        <p className="text-muted">Nothing here yet.</p>
      )}
      <CardPages
        first={first}
        loadMore={loadMoreRatedReviews.bind(null, id, String(rating))}
      />
    </main>
  );
}
