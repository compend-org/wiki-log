// ABOUTME: The home page feeds (Following, Everyone and Trending), a page at a time.
// ABOUTME: Renders the first page on the server; FeedPages adds later pages below.
import Link from "next/link";
import { connection } from "next/server";
import FeedPages from "@/components/feed/FeedPages";
import { type FeedMode, loadFeedPage } from "@/components/feed/loadFeedPage";
import SuggestedPeople from "@/components/people/SuggestedPeople";
import { getPublicSuggestedPeople } from "@/lib/feed/publicSuggestedPeople";
import {
  getSuggestedPeople,
  SUGGEST_BELOW,
  SUGGESTIONS_SHOWN,
  type SuggestedPerson,
  sample,
  suggestionsDismissed,
} from "@/lib/feed/suggestedPeople";
import { FIRST_PAGE } from "@/lib/paging";
import { TRENDING_HOURS } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

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

  // On Following, people who follow few others get people to follow, picked
  // for them. Signed-out visitors, who follow no one, get a few active people.
  const viewerId = page.viewerId;
  let suggestions: SuggestedPerson[] = [];
  if (mode === "following") {
    if (!viewerId) {
      suggestions = sample(await getPublicSuggestedPeople(), SUGGESTIONS_SHOWN);
    } else if (page.followedCount < SUGGEST_BELOW) {
      // Someone who dismissed the box isn't shown it again for a while
      const supabase = await createClient();
      const { data: settings } = await supabase
        .from("user_settings")
        .select("suggested_people_dismissed_at")
        .eq("user_id", viewerId)
        .maybeSingle();
      if (!suggestionsDismissed(settings?.suggested_people_dismissed_at)) {
        suggestions = await getSuggestedPeople(supabase, SUGGESTIONS_SHOWN);
      }
    }
  }

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
          You&apos;re not following anyone yet.{" "}
          {suggestions.length > 0
            ? "Follow a few people below to fill this feed, use the search icon at the top to find others, or switch to Everyone."
            : "Use the search icon at the top to find people and follow them to fill this feed, or switch to Everyone."}
        </p>
      )}

      {suggestions.length > 0 && (
        <SuggestedPeople
          viewerId={viewerId}
          people={suggestions}
          heading={
            page.noFollows || page.needsSignIn
              ? "People to follow"
              : "Suggested for you"
          }
        />
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
