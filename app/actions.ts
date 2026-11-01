"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getItemById } from "@/lib/wikipedia";
import { cleanName, escapeLike, isValidName } from "@/lib/username";

const ITEM_ID = /^Q\d+$/;

// Looks the item up on Wikipedia and Wikidata and caches it
// (users can't write to `items` themselves)
async function ensureItem(itemId: string): Promise<string | null> {
  const result = await getItemById(itemId);
  if ("error" in result) return result.error;
  const { item } = result;

  const { error } = await createAdminClient().from("items").upsert({
    id: item.id,
    title: item.title,
    description: item.description,
    image_url: item.imageUrl,
    page_url: item.pageUrl,
    fetched_at: new Date().toISOString(),
  });
  return error ? error.message : null;
}

export async function logItem(input: {
  itemId: string;
  rating: number;
  review: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "You need to sign in to log items." };

  if (!ITEM_ID.test(input.itemId)) return { error: "Invalid item." };
  if (
    !Number.isFinite(input.rating) ||
    input.rating < 0.5 ||
    input.rating > 5 ||
    (input.rating * 2) % 1 !== 0
  ) {
    return { error: "Invalid rating." };
  }

  // The server looks the item up itself instead of trusting the browser
  const itemError = await ensureItem(input.itemId);
  if (itemError) return { error: itemError };

  // Saved as the signed-in user, so RLS applies
  const { error } = await supabase.from("logs").upsert({
    user_id: userId,
    item_id: input.itemId,
    rating: input.rating,
    review: input.review.slice(0, 5000),
    logged_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  return {};
}

export async function deleteAccount(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "You need to be signed in." };

  // Deleting the auth user also deletes their profile, logs, favourites and
  // follows (the foreign keys use "on delete cascade")
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  await supabase.auth.signOut();
  return {};
}

export async function signIn(input: {
  identifier: string;
  password: string;
}): Promise<{ error?: string }> {
  const generic = "Invalid login credentials";
  let email = input.identifier.trim();

  // No "@" means it's a name: look up the email on the server only
  if (!email.includes("@")) {
    const name = cleanName(email);
    if (!isValidName(name)) return { error: generic };

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", escapeLike(name))
      .maybeSingle();
    if (!profile) return { error: generic };

    const { data, error } = await admin.auth.admin.getUserById(profile.id);
    if (error || !data.user?.email) return { error: generic };
    email = data.user.email;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (error) return { error: error.message };
  return {};
}

export async function setFavourite(input: {
  position: number;
  itemId: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "You need to sign in." };

  if (
    !Number.isInteger(input.position) ||
    input.position < 1 ||
    input.position > 5
  ) {
    return { error: "Invalid slot." };
  }
  if (!ITEM_ID.test(input.itemId)) return { error: "Invalid item." };

  const itemError = await ensureItem(input.itemId);
  if (itemError) return { error: itemError };

  const { error } = await supabase
    .from("favourites")
    .upsert(
      { user_id: userId, position: input.position, item_id: input.itemId },
      { onConflict: "user_id,position" }
    );
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "That item is already in your top 5."
          : error.message,
    };
  }
  return {};
}

export async function removeFavourite(
  position: number
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "You need to sign in." };

  const { error } = await supabase
    .from("favourites")
    .delete()
    .eq("user_id", userId)
    .eq("position", position);
  return error ? { error: error.message } : {};
}