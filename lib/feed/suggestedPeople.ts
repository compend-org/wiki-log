// ABOUTME: People to suggest the viewer follow, chosen for them in the database.
// ABOUTME: The Following tab shows them to people who follow few others.

import type { SupabaseClient } from "@supabase/supabase-js";

// The Following tab suggests people only to someone following fewer than this
// many, i.e. nobody yet. Following from the box doesn't hide it straight away
// (the follow button skips its refresh there); it's gone on the next load.
export const SUGGEST_BELOW = 1;
// How many people it suggests at a time
export const SUGGESTIONS_SHOWN = 6;
// After someone dismisses the box, it stays away this many days
const DISMISS_DAYS = 30;

// Whether the box was dismissed recently enough to keep it hidden. `dismissedAt`
// is when they dismissed it, if they ever did.
export function suggestionsDismissed(
  dismissedAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!dismissedAt) return false;
  return now - Date.parse(dismissedAt) < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export type SuggestedPerson = {
  id: string;
  username: string;
  avatar_path: string | null;
  // What they logged in the last 7 days
  recent_logs: number;
  followers: number;
  reason: "follows_you" | "mutuals" | "overlap" | "active";
  // How many of the same things the viewer has logged
  overlap: number;
  // How many people the viewer follows follow them, and one of those people
  mutuals: number;
  mutual_name: string | null;
  // Up to 2 items to name: ones you have both logged, or their most noticed
  // this week (see suggested_people)
  featured: FeaturedItem[];
};

// Up to `limit` people for the signed-in viewer to follow. Suggestions are
// extra, so if they can't be read the feed is shown without them.
export async function getSuggestedPeople(
  supabase: SupabaseClient,
  limit: number,
): Promise<SuggestedPerson[]> {
  const { data, error } = await supabase.rpc("suggested_people", {
    p_limit: limit,
  });
  if (error || !data) return [];
  // `featured` is missing until the database has the migration that adds it
  return (
    data as (Omit<SuggestedPerson, "featured"> & {
      featured?: FeaturedItem[] | null;
    })[]
  ).map((p) => ({ ...p, featured: p.featured ?? [] }));
}

// An item named in a suggestion, linked to its page
export type FeaturedItem = { id: string; title: string };

// A suggestion's line is text with items in it, which are shown as links
export type ReasonPart = string | FeaturedItem;

// A long title is cut short to fit the line
const MAX_TITLE = 40;
export function shortTitle(title: string): string {
  return title.length > MAX_TITLE
    ? `${title.slice(0, MAX_TITLE - 1).trimEnd()}…`
    : title;
}

// "A", "A and B", or with `more` others, "A, B and 3 more"
function listItems(items: FeaturedItem[], more: number): ReasonPart[] {
  const parts: ReasonPart[] = [];
  items.forEach((item, i) => {
    if (i > 0)
      parts.push(i === items.length - 1 && more === 0 ? " and " : ", ");
    parts.push(item);
  });
  if (more > 0) parts.push(` and ${more} more`);
  return parts;
}

// Why a person is suggested, in a few words, with the items it mentions
export function suggestionParts(p: SuggestedPerson): ReasonPart[] {
  switch (p.reason) {
    case "follows_you":
      return ["Follows you"];
    case "mutuals":
      if (p.mutuals > 1 && p.mutual_name) {
        const others = p.mutuals - 1;
        return [
          `Followed by ${p.mutual_name} and ${others} other${others === 1 ? "" : "s"} you follow`,
        ];
      }
      return [
        p.mutual_name
          ? `Followed by ${p.mutual_name}, who you follow`
          : "Followed by people you follow",
      ];
    case "overlap":
      if (p.featured.length === 0)
        return [
          p.overlap === 1
            ? "Logged something you've logged"
            : `Logged ${p.overlap} things you've logged`,
        ];
      return [
        "You both logged ",
        ...listItems(p.featured, Math.max(0, p.overlap - p.featured.length)),
      ];
    case "active": {
      const lead = `${p.recent_logs} ${p.recent_logs === 1 ? "log" : "logs"} this week`;
      if (p.featured.length === 0) return [lead];
      return [`${lead}, including `, ...listItems(p.featured, 0)];
    }
  }
}

// `count` of the items, chosen at random, so each visitor gets their own few
export function sample<T>(
  items: T[],
  count: number,
  random: () => number = Math.random,
): T[] {
  const rest = [...items];
  const chosen: T[] = [];
  while (chosen.length < count && rest.length > 0) {
    chosen.push(...rest.splice(Math.floor(random() * rest.length), 1));
  }
  return chosen;
}
