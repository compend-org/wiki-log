// ABOUTME: Active people to suggest to signed-out visitors, the same for all of them.
// ABOUTME: Cached in the shared remote cache; each visit then picks its own few from the list.
import { createClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";
import type { FeaturedItem, SuggestedPerson } from "@/lib/feed/suggestedPeople";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/connection";
import { reportFailedResponses } from "@/lib/supabase/reportFailedResponses";

type Row = {
  id: string;
  username: string;
  avatar_path: string | null;
  recent_logs: number;
  followers: number | string;
  featured: FeaturedItem[] | null;
};

// The most active people lately. Suggestions are extra, so if they can't be
// read the page is shown without them.
export async function getPublicSuggestedPeople(): Promise<SuggestedPerson[]> {
  // Shared by every server instance, and read again about every 5 minutes.
  // The numbers must be written out here as plain values.
  "use cache: remote";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

  const supabase = createClient(supabaseUrl(), supabasePublishableKey(), {
    global: { fetch: reportFailedResponses },
  });
  const { data, error } = await supabase.rpc("suggested_people_public", {
    p_limit: 24,
  });
  if (error || !data) return [];
  return (data as Row[]).map((r) => ({
    ...r,
    followers: Number(r.followers),
    featured: r.featured ?? [],
    reason: "active",
    overlap: 0,
    mutuals: 0,
    mutual_name: null,
  }));
}
