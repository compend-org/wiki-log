import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import Feed from "@/components/Feed";
import FeedTabs from "@/components/FeedTabs";
import ItemSearch from "@/components/ItemSearch";
import PickSquare from "@/components/PickSquare";
import { getDailyPicks } from "@/lib/dailyPicks";
import { FEATURES } from "@/lib/features";
import { parseLimit } from "@/lib/paging";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type Tab = "following" | "everyone" | "trending";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; limit?: string }>;
}) {
  await connection();
  const { tab, limit } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const picks = FEATURES.dailyPicks ? await getDailyPicks() : null;

  // Signed-in visitors start on Following, signed-out ones on Everyone
  const initialTab: Tab =
    tab === "following" || tab === "everyone"
      ? tab
      : tab === "trending" && FEATURES.trending
        ? "trending"
        : signedIn
          ? "following"
          : "everyone";
  const feedLimit = parseLimit(limit);

  const loading = <p className="py-12 text-center text-muted">Loading…</p>;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 p-4 sm:p-8">
      {/* The two squares sit at the far left and far right. On wide screens
          the search is between them. Below that, they form a row above it. */}
      <div className="grid grid-cols-2 items-start gap-4 xl:grid-cols-[1fr_minmax(0,42rem)_1fr] xl:gap-8">
        {picks && (
          <div className="order-1 w-full justify-self-start">
            <PickSquare heading="Popular Today " pick={picks.popular} />
          </div>
        )}

        <div className="order-3 col-span-2 flex flex-col gap-8 xl:order-2 xl:col-span-1 xl:col-start-2 xl:self-center">
          {!signedIn && (
            <p className="text-center text-sm">
              <Link
                href="/login"
                className="text-accent underline hover:no-underline"
              >
                Create an account
              </Link>{" "}
              or{" "}
              <Link
                href="/?tab=everyone"
                className="text-accent underline hover:no-underline"
              >
                browse
              </Link>
            </p>
          )}

          <ItemSearch signedIn={signedIn} />
        </div>

        {picks && (
          <div className="order-2 flex w-full justify-end xl:order-3">
            <PickSquare heading="Unpopular Today" pick={picks.unpopular} />
          </div>
        )}
      </div>

      <FeedTabs
        initial={initialTab}
        following={
          <Suspense fallback={loading}>
            <Feed mode="following" limit={feedLimit} />
          </Suspense>
        }
        everyone={
          <Suspense fallback={loading}>
            <Feed mode="everyone" limit={feedLimit} />
          </Suspense>
        }
        trending={
          FEATURES.trending ? (
            <Suspense fallback={loading}>
              <Feed mode="trending" limit={feedLimit} />
            </Suspense>
          ) : undefined
        }
      />
    </main>
  );
}
