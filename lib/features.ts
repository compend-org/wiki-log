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
  dailyPicks: flag(process.env.NEXT_PUBLIC_FEATURE_DAILY_PICKS, false),
};