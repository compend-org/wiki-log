// Turn features on and off here.
//
// Change the default (true or false), or override it without editing code by
// setting NEXT_PUBLIC_FEATURE_COMPOUNDS=false (or true) in .env.local or in
// Vercel's environment variables. The value is baked in when the app starts or
// builds, so restart the dev server or redeploy after changing it.

function flag(value: string | undefined, fallback: boolean): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export const FEATURES = {
  // Crafting compounds (the Craft page and its search results)
  compounds: flag(process.env.NEXT_PUBLIC_FEATURE_COMPOUNDS, false),
  // The "Popular" and "Unpopular" squares on the home page
  dailyPicks: flag(process.env.NEXT_PUBLIC_FEATURE_DAILY_PICKS, true),
  // The Trending tab on the home page
  trending: flag(process.env.NEXT_PUBLIC_FEATURE_TRENDING, true),
  // leaderboards page
  leaderboards: flag(process.env.NEXT_PUBLIC_FEATURE_LEADERBOARDS, false),
  // Grouped lists: lists whose items sit in groups, labeled or not. Off hides
  // the option to make one and shows existing ones as plain lists.
  groupedLists: flag(process.env.NEXT_PUBLIC_FEATURE_GROUPED_LISTS, true),
  // Review lists: lists of people's reviews, added to from a review's page.
  // Off hides Add to list and "In n lists" on reviews; existing review lists
  // still show.
  reviewLists: flag(process.env.NEXT_PUBLIC_FEATURE_REVIEW_LISTS, false),
};
