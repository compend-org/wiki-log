import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import ItemSearch from "@/components/ItemSearch";
import Feed from "@/components/Feed";
import FeedTabs from "@/components/FeedTabs";
import { createClient } from "@/lib/supabase/server";
import { parseLimit } from "@/lib/paging";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

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

  // Signed-in visitors start on Following, signed-out ones on Everyone
  const initialTab: "following" | "everyone" =
    tab === "following" || tab === "everyone"
      ? tab
      : signedIn
        ? "following"
        : "everyone";
  const feedLimit = parseLimit(limit);

  const loading = <p className="text-muted">Loading…</p>;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 p-4 sm:p-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
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

        <ItemSearch />
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