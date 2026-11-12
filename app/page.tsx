import Link from "next/link";
import { connection } from "next/server";
import ShareImageButton from "@/components/buttons/ShareImageButton";
import Digest from "@/components/Digest";
import Feed from "@/components/Feed";
import FeedTabs, { type FeedTab } from "@/components/FeedTabs";
import ItemSearch from "@/components/ItemSearch";
import PickSquare from "@/components/PickSquare";
import { getDailyPicks } from "@/lib/dailyPicks";
import { FEATURES } from "@/lib/features";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await connection();
  const { tab } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const viewerId: string | undefined = data?.claims?.sub;
  const signedIn = Boolean(viewerId);

  const picks = FEATURES.dailyPicks ? await getDailyPicks() : null;

  // On phones, shares both squares as one picture
  const sharePicks = picks && (
    <ShareImageButton
      imageHref="/picks/image"
      fileName="popular-today.png"
      className="sm:hidden"
    />
  );

  // Signed-in visitors start on Following, signed-out ones on Everyone
  const initialTab: FeedTab =
    tab === "following" || tab === "everyone" || tab === "digest"
      ? tab
      : tab === "trending" && FEATURES.trending
        ? "trending"
        : signedIn
          ? "following"
          : "everyone";

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 p-4 sm:p-8">
      {/* The two squares sit at the far left and far right. On wide screens
          the search is between them. Below that, they form a row above it. */}
      <div className="grid grid-cols-2 items-center gap-4 xl:grid-cols-[1fr_minmax(0,42rem)_1fr] xl:gap-8">
        {picks && (
          <div className="order-1 w-full justify-self-start">
            <PickSquare
              heading="Popular Today "
              kind="popular"
              pick={picks.popular}
            />
          </div>
        )}

        <div className="order-3 col-span-2 flex flex-col gap-8 xl:order-2 xl:col-span-1 xl:col-start-2 xl:self-center">
          {/* The sign-up links are centred. On phones, the button that shares
              both squares as one picture sits at the right end of their row. */}
          {!signedIn && (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center">
              <p className="col-start-2 text-center text-sm">
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
              {sharePicks && (
                <div className="col-start-3 justify-self-end">{sharePicks}</div>
              )}
            </div>
          )}

          {/* Signed in, there are no sign-up links, so the share button sits
              at the right end of the search's heading instead */}
          <ItemSearch
            signedIn={signedIn}
            headingAction={signedIn ? sharePicks : null}
          />
        </div>

        {picks && (
          <div className="order-2 flex w-full justify-end xl:order-3">
            <PickSquare
              heading="Unpopular Today"
              kind="unpopular"
              pick={picks.unpopular}
            />
          </div>
        )}
      </div>

      {/* Signing in or out starts the tabs afresh */}
      <FeedTabs
        key={viewerId ?? ""}
        initial={initialTab}
        initialFeed={
          initialTab === "digest" ? <Digest /> : <Feed mode={initialTab} />
        }
      />
    </main>
  );
}
