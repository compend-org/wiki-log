// ABOUTME: The leaderboards shown on the Leaderboards page, chosen by hand.
// ABOUTME: Add, remove or change one here; no database change is needed.

export type Leaderboard = {
    // Used in the address: /leaderboards?board=years
    slug: string;
    title: string;
    description?: string;
    // Wikidata IDs (what an item is an instance of). An item is ranked here if
    // it has any one of them. Find the IDs in the item_types table.
    types: string[];
    // Items with fewer ratings than this are left out (3 if not given)
    minRatings?: number;
};

export const LEADERBOARDS: Leaderboard[] = [
    {
        slug: "years",
        title: "Years",
        description: "The best-rated years.",
        // Check these against your data: select * from item_types where label ilike '%year%';
        types: ["Q235690", "Q217026", "Q235729", "Q3186692", "Q235670", "Q3186692","Q19828", "Q217036","Q3186692"],
        minRatings: 3,
    },
];

export const DEFAULT_MIN_RATINGS = 3;
export const LEADERBOARD_SIZE = 50;