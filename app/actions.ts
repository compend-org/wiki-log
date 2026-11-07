// ABOUTME: Server actions for accounts, logs, favourites, lists and compounds.
// ABOUTME: Caches items looked up from Wikipedia before anything refers to them.
"use server";

import { isAdmin } from "@/lib/admin";
import { FEATURES } from "@/lib/features";
import { ITEM_ID_PATTERN, isCompoundId, isUuid } from "@/lib/ids";
import {
  applyImageHidden,
  itemColumns,
  MAX_AGE_MS,
  STALE_COPY_WAIT_MS,
} from "@/lib/items";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cleanName, isValidName } from "@/lib/username";
import { getItemById } from "@/lib/wikipedia";
import { updateTag } from "next/cache";
import { POSTS_CACHE_TAG } from "@/lib/cacheTags";

const ITEM_ID = ITEM_ID_PATTERN;

// A stored item's ID, title and image, or why it couldn't be stored
type StoredItem =
  | { error: string }
  | { id: string; title: string; imageUrl: string | null };

// Looks the item up on Wikipedia and Wikidata and caches it
// (users can't write to `items` themselves)
async function ensureItem(itemId: string): Promise<StoredItem> {
  // Compounds only exist in our own database
  if (isCompoundId(itemId)) {
    const { data } = await createAdminClient()
      .from("items")
      .select("title, image_url")
      .eq("id", itemId)
      .maybeSingle();
    return data
      ? { id: itemId, title: data.title, imageUrl: data.image_url }
      : { error: "That compound doesn't exist." };
  }
  const { data: existing } = await createAdminClient()
    .from("items")
    .select("title, image_url, fetched_at, image_hidden")
    .eq("id", itemId)
    .maybeSingle();
  if (
    existing &&
    Date.now() - new Date(existing.fetched_at).getTime() < MAX_AGE_MS
  ) {
    return { id: itemId, title: existing.title, imageUrl: existing.image_url };
  }
  // With a stale copy to fall back on, saving doesn't wait long on Wikipedia
  const result = await getItemById(
    itemId,
    existing ? Date.now() + STALE_COPY_WAIT_MS : undefined,
  );
  // An item we already have stays usable when refreshing it fails
  if ("error" in result) {
    return existing
      ? { id: itemId, title: existing.title, imageUrl: existing.image_url }
      : { error: result.error };
  }

  // A hidden image stays hidden
  const item = applyImageHidden(result.item, existing?.image_hidden === true);

  const { error } = await createAdminClient()
    .from("items")
    .upsert({ id: item.id, ...itemColumns(item) });
  // Wikipedia can resolve a different ID; callers must reference the stored row.
  return error
    ? { error: error.message }
    : { id: item.id, title: item.title, imageUrl: item.imageUrl };
}

export async function logItem(input: {
  itemId: string;
  rating: number | null;
  review: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "You need to sign in to log items." };

  if (!ITEM_ID.test(input.itemId)) return { error: "Invalid item." };
  if (
    input.rating !== null &&
    (!Number.isFinite(input.rating) ||
      input.rating < 0.5 ||
      input.rating > 5 ||
      (input.rating * 2) % 1 !== 0)
  ) {
    return { error: "Invalid rating." };
  }

  // The server looks the item up itself instead of trusting the browser
  const stored = await ensureItem(input.itemId);
  if ("error" in stored) return { error: stored.error };

  // Saved as the signed-in user, so RLS applies
  const { error } = await supabase.from("logs").insert({
    user_id: userId,
    item_id: stored.id,
    rating: input.rating,
    review: input.review.slice(0, 5000),
  });
  if (error) return { error: error.message };

  return {};
}

// Deletes someone's avatar files and their auth user
async function removeAccount(userId: string): Promise<{ error?: string }> {
  // Deleting the auth user also deletes their profile, logs, favourites and
  // follows (the foreign keys use "on delete cascade")
  const admin = createAdminClient();
  const { data: files } = await admin.storage.from("avatars").list(userId);
  if (files && files.length > 0) {
    await admin.storage
      .from("avatars")
      .remove(files.map((f) => `${userId}/${f.name}`));
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  // Their posts are gone from the database, but the feeds, digest and
  // leaderboards keep a copy for a few minutes. Drop those copies now.
  updateTag(POSTS_CACHE_TAG);
  return {};
}
}

export async function deleteAccount(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "You need to be signed in." };

  const result = await removeAccount(userId);
  if (result.error) return result;

  await supabase.auth.signOut();
  return {};
}

// Admins only: blocks the person's email from signing up again, then deletes
// their account and everything they posted
export async function banUser(userId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!(await isAdmin(data?.claims?.sub))) {
    return { error: "Only admins can ban people." };
  }
  if (!isUuid(userId)) return { error: "Invalid user." };
  if (await isAdmin(userId)) return { error: "Admins can't be banned." };

  const admin = createAdminClient();
  const { data: target, error: lookupError } =
    await admin.auth.admin.getUserById(userId);
  if (lookupError) return { error: lookupError.message };

  if (target.user.email) {
    const { data: email, error: normalizeError } = await admin.rpc(
      "normalize_email",
      { e: target.user.email },
    );
    if (normalizeError) return { error: normalizeError.message };
    const { error } = await admin
      .from("blocked_emails")
      .upsert({ email, reason: "banned" }, { ignoreDuplicates: true });
    if (error) return { error: error.message };
  }

  return removeAccount(userId);
}

export async function signIn(input: {
  identifier: string;
  password: string;
  captchaToken?: string;
}): Promise<{ error?: string }> {
  const generic = "Invalid sign-in credentials";
  let email = input.identifier.trim();

  // No "@" means it's a name: look up the email on the server only
  if (!email.includes("@")) {
    const name = cleanName(email);
    if (!isValidName(name)) return { error: generic };

    const admin = createAdminClient();
    const { data: profile } = await admin
      .rpc("profile_by_username", { name })
      .select("id")
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
    options: { captchaToken: input.captchaToken },
  });
  if (error) {
    return {
      error: error.code === "invalid_credentials" ? generic : error.message,
    };
  }
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
  const stored = await ensureItem(input.itemId);
  if ("error" in stored) return { error: stored.error };

  const { error } = await supabase
    .from("favourites")
    .upsert(
      { user_id: userId, position: input.position, item_id: stored.id },
      { onConflict: "user_id,position" },
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
  position: number,
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

export async function addToList(input: {
  listId: string;
  itemId: string;
  order?: string[];
}): Promise<{
  error?: string;
  item?: { itemId: string; title: string; imageUrl: string | null };
}> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "You need to sign in." };

  if (!isUuid(input.listId)) return { error: "Invalid list." };
  if (!ITEM_ID.test(input.itemId)) return { error: "Invalid item." };
  if (
    input.order &&
    (input.order.length > 101 || !input.order.every((id) => ITEM_ID.test(id)))
  ) {
    return { error: "Invalid order." };
  }

  const { data: list } = await supabase
    .from("lists")
    .select("id")
    .eq("id", input.listId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!list) return { error: "That list isn't yours." };

  const stored = await ensureItem(input.itemId);
  if ("error" in stored) return { error: stored.error };

  const { data: last } = await supabase
    .from("list_items")
    .select("position")
    .eq("list_id", input.listId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("list_items").insert({
    list_id: input.listId,
    item_id: stored.id,
    position: (last?.position ?? 0) + 1,
  });
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "That item is already in this list."
          : error.message,
    };
  }

  // Ranked lists: move the new item into the place the user chose
  if (input.order) {
    const { error: orderError } = await supabase.rpc("reorder_list_items", {
      p_list: input.listId,
      p_items: input.order.map((id) => (id === input.itemId ? stored.id : id)),
    });
    if (orderError) return { error: orderError.message };
  }

  return {
    item: {
      itemId: stored.id,
      title: stored.title,
      imageUrl: stored.imageUrl,
    },
  };
}

export async function createCompound(input: {
  title: string;
  description: string;
  parts: string[];
}): Promise<{
  id?: string;
  existing?: { id: string; title: string };
  error?: string;
}> {
  if (!FEATURES.compounds) return { error: "Crafting is turned off." };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "You need to sign in to craft." };

  const title = input.title.trim().replace(/\s+/g, " ");
  const description = input.description.trim();
  if (title.length < 1 || title.length > 80) {
    return { error: "Names are 1–80 characters." };
  }
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the purpose of this check
  if (/[\u0000-\u001f]/.test(title)) {
    return { error: "That name has invalid characters." };
  }
  if (description.length > 500) {
    return { error: "Descriptions are at most 500 characters." };
  }

  const parts = input.parts;
  if (!Array.isArray(parts) || parts.length < 2 || parts.length > 8) {
    return { error: "A compound needs 2 to 8 ingredients." };
  }
  if (!parts.every((p) => typeof p === "string" && ITEM_ID.test(p))) {
    return { error: "Invalid ingredient." };
  }
  if (new Set(parts).size !== parts.length) {
    return { error: "Each ingredient can only be used once." };
  }

  // Make sure every ingredient is stored in the database
  const stored = await Promise.all(parts.map((p) => ensureItem(p)));
  const resolvedParts: string[] = [];
  for (const part of stored) {
    if ("error" in part) return { error: part.error };
    resolvedParts.push(part.id);
  }
  if (new Set(resolvedParts).size !== resolvedParts.length) {
    return { error: "Each ingredient can only be used once." };
  }

  const { data: result, error } = await createAdminClient().rpc(
    "create_compound",
    {
      p_user: userId,
      p_title: title,
      p_description: description,
      p_parts: resolvedParts,
    },
  );
  if (error) return { error: error.message };

  const r = result as { id: string; title: string; existing: boolean };
  return r.existing ? { existing: { id: r.id, title: r.title } } : { id: r.id };
}
