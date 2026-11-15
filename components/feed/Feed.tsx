// ABOUTME: The home page feeds (Following, Everyone and Trending), a page at a time.
// ABOUTME: Renders the first page on the server; FeedPages adds later pages below.
import Link from "next/link";
import { connection } from "next/server";
import FeedPages from "@/components/FeedPages";
import { type FeedMode, loadFeedPage } from "@/components/loadFeedPage";
import { FIRST_PAGE } from "@/lib/paging";
import { TRENDING_HOURS } from "@/lib/site";

export default async function Feed({ mode }: { mode: FeedMode }) {
  await connection();
  // When this feed was first loaded. Later pages leave out anything newer.
  const asOf = new Date().toISOString();
  const page = await loadFeedPage(mode, asOf, FIRST_PAGE);
  // A first page can come back with nothing to show, such as only empty
  // lists, while more is still to come
  const hasMore = Boolean(page.next.reviews || page.next.lists);
  const empty =
    page.reviews.length === 0 && page.lists.length === 0 && !hasMore;

  return (
    <section className="flex flex-col gap-4">
      {page.needsSignIn && (
        <p className="text-center text-muted">
          <Link href="/login" className="underline">
            Sign in
          </Link>{" "}
          to follow people and see what they log here.
        </p>
      )}

      {page.noFollows && (
        <p className="text-center text-muted">
          You&apos;re not following anyone yet. Use the search icon at the top
          to find people and follow them to fill this feed, or switch to
          Everyone.
        </p>
      )}

      {page.error && <p className="text-center text-danger">{page.error}</p>}

      {/* Only when there is genuinely nothing to show */}
      {!page.needsSignIn && !page.noFollows && !page.error && empty && (
        <p className="text-center text-muted">
          {mode === "following"
            ? "Nothing here yet. Log something, or follow people to see what they log."
            : mode === "trending"
              ? `Nothing has been liked in the last ${TRENDING_HOURS} hours.`
              : "Nothing here yet."}
        </p>
      )}

      {!empty && <FeedPages mode={mode} asOf={asOf} first={page} />}
    </section>
  );
}
