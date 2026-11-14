// ABOUTME: The compounds a person has crafted, for their profile page.
// ABOUTME: Newest first, as plain data; empty while crafting is turned off.
import type { SupabaseClient } from "@supabase/supabase-js";
import { FEATURES } from "@/lib/features";

export type ProfileCompound = {
  id: string;
  title: string;
  imageUrl: string | null;
  nsfw: boolean;
};

// Most a profile shows. Crafting is rate limited, so few people get near it.
const MAX_COMPOUNDS = 60;

export async function getProfileCompounds(
  supabase: SupabaseClient,
  profileId: string,
): Promise<ProfileCompound[]> {
  if (!FEATURES.compounds) return [];
  const { data: made } = await supabase
    .from("compounds")
    .select("item_id")
    .eq("creator_id", profileId)
    .order("created_at", { ascending: false })
    .order("item_id", { ascending: false })
    .limit(MAX_COMPOUNDS);
  const ids = ((made ?? []) as { item_id: string }[]).map((c) => c.item_id);
  if (ids.length === 0) return [];

  const { data: items } = await supabase
    .from("items")
    .select("id, title, image_url, nsfw")
    .in("id", ids);
  const byId = new Map(
    (
      (items ?? []) as {
        id: string;
        title: string;
        image_url: string | null;
        nsfw: boolean;
      }[]
    ).map((i) => [i.id, i]),
  );
  return ids.flatMap((id) => {
    const item = byId.get(id);
    return item
      ? [
          {
            id,
            title: item.title,
            imageUrl: item.image_url,
            nsfw: item.nsfw,
          },
        ]
      : [];
  });
}
