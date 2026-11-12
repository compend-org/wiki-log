// ABOUTME: Every review of the same item that a reviewer liked, as a scrolling list of cards.
// ABOUTME: Reached from the "Liked by" row under a review.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import ItemLogCard from "@/components/ItemLogCard";
import { getAdminIds } from "@/lib/admin";
import { isUuid } from "@/lib/ids";
import { getItemLogsLikedBy } from "@/lib/itemLogs";
import { pageMetadata } from "@/lib/metadata";
import { getProfileByName } from "@/lib/profiles";
import { getReview } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/server";
import { getViewerState } from "@/lib/viewerState";

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
  await connection();
  const renderedAt = Date.now();
  const { username, logId } = await params;
  if (!isUuid(logId)) notFound();

  const profile = await getProfileByName(username);
  if (!profile) notFound();
  const log = await getReview(logId, profile.id);
  if (!log) notFound();

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId: string | undefined = claimsData?.claims?.sub;

  const { rows, error } = await getItemLogsLikedBy(log.item_id, log.user_id);

  const viewer = await getViewerState(supabase, viewerId, {
    logIds: rows.map((r) => r.id),
  });
  const adminIds = await getAdminIds();

  // Reviews by people the viewer has blocked aren't shown
  const visible = rows.filter((r) => !viewer.blocked.has(r.user_id));
  const title = log.items?.title ?? "Unknown item";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <Link
        href={`/u/${encodeURIComponent(profile.username)}/${log.id}`}
        className="text-sm text-muted"
      >
        ‹ Back to {profile.username}'s review
      </Link>
      <h1 className="text-xl font-bold">Liked by {profile.username}</h1>
      <p className="-mt-3 text-sm text-muted">
        Reviews of{" "}
        <Link href={`/item/${log.item_id}`} className="underline">
          {title}
        </Link>
      </p>
      {error && <p className="text-danger">{error}</p>}
      {visible.length === 0 && !error && (
        <p className="text-muted">Nothing here yet.</p>
      )}
      {visible.map((row) => (
        <ItemLogCard
          key={row.id}
          row={row}
          isAdmin={adminIds.has(row.user_id)}
          renderedAt={renderedAt}
          viewerId={viewerId}
          viewer={viewer}
        />
      ))}
    </main>
  );
}
