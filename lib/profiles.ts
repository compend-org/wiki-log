// ABOUTME: Looks up a person's profile from the username in a page's address.
// ABOUTME: Cached per request, so a page and its metadata share one lookup.
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isValidName } from "@/lib/username";

export type Profile = {
  id: string;
  username: string;
  avatar_path: string | null;
  bio: string | null;
};

// The profile for a URL-encoded username, or null when there's no such person
export const getProfileByName = cache(
  async (rawName: string): Promise<Profile | null> => {
    let name = rawName;
    try {
      name = decodeURIComponent(rawName);
    } catch {}
    if (!isValidName(name)) return null;

    const supabase = await createClient();
    const { data } = await supabase
      .rpc("profile_by_username", { name })
      .select("id, username, avatar_path, bio")
      .maybeSingle();
    return data as Profile | null;
  },
);
