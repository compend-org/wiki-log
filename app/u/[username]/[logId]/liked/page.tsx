// ABOUTME: Every review of the same item that a reviewer liked, as cards that load as you scroll.
// ABOUTME: Reached from the "Liked by" row under a review.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { loadMoreLikedReviews } from "@/app/itemPagesActions";
import { loadLikedReviewsPage } from "@/components/items/loadItemPages";
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
    title: `Reviews of ${itemTitle} liked by ${profile.username}`,
  });
}

export default async function LikedReviewsPage({
  params,
}: {
  params: Promise<{ username: string; logId: string }>;
}) {
  const t = await getTranslations();
  await connection();
  const { username, logId } = await params;
  if (!isUuid(logId)) notFound();

  const profile = await getProfileByName(username);
  if (!profile) notFound();
  const log = await getReview(logId, profile.id);
  if (!log) notFound();

  const first = await loadLikedReviewsPage(log.item_id, log.user_id, null);
  const title = log.items?.title ?? "Unknown item";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <Link
        href={`/u/${encodeURIComponent(profile.username)}/${log.id}`}
        className="text-sm text-muted"
      >
        {t("profile.backTo", {
          name: t("profile.reviewOf", { name: profile.username }),
        })}
      </Link>
      <h1 className="text-xl font-bold">
        {t("profile.likedByUser", { name: profile.username })}
      </h1>
      <p className="-mt-3 text-sm text-muted">
        {t.rich("profile.reviewsOf", {
          title,
          link: (c) => (
            <Link href={`/item/${log.item_id}`} className="underline">
              {c}
            </Link>
          ),
        })}
      </p>
      {first.cards.length === 0 && !first.next && !first.error && (
        <p className="text-muted">{t("common.nothingHereYet")}</p>
      )}
      <CardPages
        first={first}
        loadMore={loadMoreLikedReviews.bind(null, log.item_id, log.user_id)}
      />
    </main>
  );
}
