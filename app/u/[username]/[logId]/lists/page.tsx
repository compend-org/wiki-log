// ABOUTME: The review lists that include one review, as cards that load as you scroll.
// ABOUTME: Reached from "In n lists" under the review.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { loadMoreReviewLists } from "@/app/itemPagesActions";
import { loadReviewListsPage } from "@/components/items/loadItemPages";
import CardPages from "@/components/paging/CardPages";
import { isUuid } from "@/lib/ids";
import { pageMetadata } from "@/lib/metadata";
import { getProfileByName } from "@/lib/profiles";
import { getReview } from "@/lib/reviews";

export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; logId: string }>;
}): Promise<Metadata> {
  await connection();
  const { username, logId } = await params;
  if (!isUuid(logId)) return {};
  const profile = await getProfileByName(username);
  if (!profile) return {};
  const log = await getReview(logId, profile.id);
  if (!log) return {};

  const itemTitle = log.items?.title ?? "Unknown item";
  return pageMetadata({
    title: `Lists with ${profile.username}'s review of ${itemTitle}`,
  });
}

export default async function ReviewListsPage({
  params,
}: {
  params: Promise<{ username: string; logId: string }>;
}) {
  await connection();
  const { username, logId } = await params;
  if (!isUuid(logId)) notFound();

  const profile = await getProfileByName(username);
  if (!profile) notFound();
  const log = await getReview(logId, profile.id);
  if (!log) notFound();

  const first = await loadReviewListsPage(log.id, null);
  const title = log.items?.title ?? "Unknown item";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <Link
        href={`/u/${encodeURIComponent(profile.username)}/${log.id}`}
        className="text-sm text-muted"
      >
        ‹ Back to {profile.username}'s review
      </Link>
      <h1 className="text-xl font-bold">In lists</h1>
      <p className="-mt-3 text-sm text-muted">
        {profile.username}'s review of{" "}
        <Link href={`/item/${log.item_id}`} className="underline">
          {title}
        </Link>
      </p>
      {first.cards.length === 0 && !first.next && !first.error && (
        <p className="text-muted">Not in any lists yet.</p>
      )}
      <CardPages
        first={first}
        loadMore={loadMoreReviewLists.bind(null, log.id)}
      />
    </main>
  );
}
