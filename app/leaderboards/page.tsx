// ABOUTME: The Leaderboards page, which ranks items of chosen kinds by their ratings.
// ABOUTME: Which leaderboards exist is set by hand in lib/leaderboards.ts; the page can be turned off in lib/features.ts.
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Leaderboard from "@/components/Leaderboard";
import { FEATURES } from "@/lib/features";

export const metadata = { title: "Leaderboards" };
export const instant = false;

export default function LeaderboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  if (!FEATURES.leaderboards) notFound();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">Leaderboards</h1>
        <p className="text-sm text-muted">The best-rated items of each kind.</p>
      </header>

      <Suspense
        fallback={<p className="py-12 text-center text-muted">Loading…</p>}
      >
        <Leaderboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
