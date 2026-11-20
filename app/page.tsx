// ABOUTME: The home page: today's popular and unpopular picks, item search and the feed.
// ABOUTME: Also tells search engines the site's name and its one address.

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import Digest from "@/components/feed/Digest";
import Feed from "@/components/feed/Feed";
import FeedTabs, { type FeedTab } from "@/components/feed/FeedTabs";
import ItemSearch from "@/components/items/ItemSearch";
import PickSquare from "@/components/items/PickSquare";
import ShareImageButton from "@/components/social/ShareImageButton";
import { FEATURES } from "@/lib/features";
import { getDailyPicks } from "@/lib/feed/dailyPicks";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

// The feed tabs are views of this one page
export const metadata: Metadata = { alternates: { canonical: "/" } };

// Lets search engines show the site's name beside its results
const websiteJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
});

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const t = await getTranslations();
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
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: the site's own constant structured data
        dangerouslySetInnerHTML={{ __html: websiteJsonLd }}
      />
      {/* The two squares sit at the far left and far right. On wide screens
          the search is between them. Below that, they form a row above it. */}
      <div className="grid grid-cols-2 items-center gap-4 xl:grid-cols-[1fr_minmax(0,42rem)_1fr] xl:gap-8">
        {picks && (
          <div className="order-1 w-full justify-self-start">
            <PickSquare
              heading={t("home.popularToday")}
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
                {t.rich("home.createAccountOrGuide", {
                  create: (chunks) => (
                    <Link
                      href="/login?mode=signup"
                      className="text-accent underline hover:no-underline"
                    >
                      {chunks}
                    </Link>
                  ),
                  guide: (chunks) => (
                    <Link
                      href="/guide"
                      className="text-accent underline hover:no-underline"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
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
              heading={t("home.unpopularToday")}
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
