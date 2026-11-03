import type { SupabaseClient } from "@supabase/supabase-js";

export type Pick = {
    itemId: string;
    title: string;
    imageUrl: string | null;
    average: number;
    count: number;
};

export type DailyPicks = {
    popular: Pick | null;
    unpopular: Pick | null;
};

type PickRow = {
    kind: string;
    item_id: string;
    avg_rating: number | string;
    n: number | string;
};

type ItemRow = {
    id: string;
    title: string;
    image_url: string | null;
    image_hidden: boolean;
};

// The best- and worst-rated items of the last 24 hours. Call after
// `await connection()`, since the window depends on the clock.
export async function getDailyPicks(
    supabase: SupabaseClient
): Promise<DailyPicks> {
    const none: DailyPicks = { popular: null, unpopular: null };

    const { data, error } = await supabase.rpc("popular_picks");
    const rows = (data ?? []) as PickRow[];
    if (error || rows.length === 0) return none;

    const { data: itemData } = await supabase
        .from("items")
        .select("id, title, image_url, image_hidden")
        .in(
            "id",
            rows.map((r) => r.item_id)
        );
    const items = new Map(((itemData ?? []) as ItemRow[]).map((i) => [i.id, i]));

    const toPick = (row: PickRow | undefined): Pick | null => {
        if (!row) return null;
        const item = items.get(row.item_id);
        if (!item) return null;
        return {
            itemId: item.id,
            title: item.title,
            imageUrl: item.image_hidden ? null : item.image_url,
            average: Number(row.avg_rating),
            count: Number(row.n),
        };
    };

    return {
        popular: toPick(rows.find((r) => r.kind === "popular")),
        unpopular: toPick(rows.find((r) => r.kind === "unpopular")),
    };
}