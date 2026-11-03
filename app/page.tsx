import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import ItemSearch from "@/components/ItemSearch";
import Feed from "@/components/Feed";
import FeedTabs from "@/components/FeedTabs";
import PickSquare from "@/components/PickSquare";
import { createClient } from "@/lib/supabase/server";
import { getDailyPicks } from "@/lib/dailyPicks";
import { FEATURES } from "@/lib/features";
import { parseLimit } from "@/lib/paging";

export const instant = false;

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

  const picks = FEATURES.dailyPicks ? await getDailyPicks(supabase) : null;

  // Signed-in visitors start on Following, signed-out ones on Everyone
  const initialTab: "following" | "everyone" =
    tab === "following" || tab === "everyone"
      ? tab
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
          <div className=" xl:self-center order-1 w-full justify-self-start">
            <PickSquare heading="Popular Today" pick={picks.popular} />
          </div>
        )}

        <div className="order-3 xl:self-center col-span-2 flex flex-col gap-8 xl:order-2 xl:col-span-1 xl:col-start-2">
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
          <div className=" xl:self-center order-2 flex w-full justify-end xl:order-3">
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
      />
    </main>
  );
}