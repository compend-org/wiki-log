// ABOUTME: Server actions for accounts, logs, comments, favourites, lists and compounds.
// ABOUTME: Caches items looked up from Wikipedia before anything refers to them.
"use server";

import { updateTag } from "next/cache";
import { POSTS_CACHE_TAG } from "@/lib/cacheTags";
import { COMMENT_TABLES, type CommentTable } from "@/lib/comments";
import { withErrorContext } from "@/lib/errorContext";
import { FEATURES } from "@/lib/features";
import { ITEM_ID_PATTERN, isCompoundId, isUuid } from "@/lib/ids";
import {
  applyImageHidden,
  itemColumns,
  MAX_AGE_MS,
  replaceBrokenImage,
  STALE_COPY_WAIT_MS,
} from "@/lib/items";
import {
  cleanNote,
  isReportReason,
  type ModerationInput,
} from "@/lib/moderation";
import {
  deletePostImageFiles,
  POST_IMAGE_BUCKETS,
  postImageFiles,
} from "@/lib/postImageFiles";
import { storedFiles } from "@/lib/postImages";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cleanName, isValidName } from "@/lib/username";
import { getItemById } from "@/lib/wikipedia";

const ITEM_ID = ITEM_ID_PATTERN;
// Matches limit_list_counts() in supabase/migrations/*_raise_list_limits.sql
const MAX_LIST_ITEMS = 10000;

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

// For an item image the browser couldn't load: the image to show instead, if any
export async function reportBrokenImage(url: string): Promise<string | null> {
  if (typeof url !== "string") return null;
  return replaceBrokenImage(url);
}

// Whether a rating is one the stars can show: half steps from 0.5 to 5, or none
function isValidRating(rating: number | null): boolean {
  return (
    rating === null ||
    (Number.isFinite(rating) &&
      rating >= 0.5 &&
      rating <= 5 &&
      (rating * 2) % 1 === 0)
  );
}

// Whether the browser sent a list of image paths. The database checks the
// paths themselves.
function isPathList(images: unknown): images is string[] {
  return (
    Array.isArray(images) && images.every((path) => typeof path === "string")
  );
}

export async function logItem(input: {
  itemId: string;
  rating: number | null;
  review: string;
  // The uploaded image's path, if one is attached
  images: string[];
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "You need to sign in to log items." };

  if (!ITEM_ID.test(input.itemId)) return { error: "Invalid item." };
  if (!isValidRating(input.rating)) return { error: "Invalid rating." };
  if (!isPathList(input.images)) return { error: "Invalid image." };

  // The server looks the item up itself instead of trusting the browser
  const stored = await ensureItem(input.itemId);
  if ("error" in stored) return { error: stored.error };

  // Saved as the signed-in user, so RLS applies
  const { error } = await withErrorContext(
    "log",
    { requestedItemId: input.itemId, itemId: stored.id },
    () =>
      supabase.from("logs").insert({
        user_id: userId,
        item_id: stored.id,
        rating: input.rating,
        review: input.review.slice(0, 5000),
        images: input.images,
      }),
  );
  if (error) return { error: error.message };

  return {};
}

// Changes your own review. An image it no longer shows is deleted.
export async function updateReview(
  logId: string,
  input: { rating: number | null; review: string; images: string[] },
): Promise<{ error?: string }> {
  if (!isUuid(logId)) return { error: "Invalid entry." };
  if (!isValidRating(input.rating)) return { error: "Invalid rating." };
  if (!isPathList(input.images)) return { error: "Invalid image." };

  // Read and saved as the signed-in user, so RLS limits both to their own
  const supabase = await createClient();
  const { data: before, error: readError } = await supabase
    .from("logs")
    .select("images")
    .eq("id", logId)
    .maybeSingle();
  if (readError) return { error: readError.message };
  if (!before) return { error: "Couldn't save that change." };

  const { data: saved, error } = await supabase
    .from("logs")
    .update({
      rating: input.rating,
      review: input.review.slice(0, 5000),
      images: input.images,
    })
    .eq("id", logId)
    .select("id");
  if (error) return { error: error.message };
  if (!saved || saved.length === 0) {
    return { error: "Couldn't save that change." };
  }

  const dropped = (before.images as string[]).filter(
    (path) => !input.images.includes(path),
  );
  if (dropped.length > 0) {
    await deletePostImageFiles(dropped.flatMap(storedFiles));
    // The feeds keep a copy for a few minutes, which would show the
    // deleted image
    updateTag(POSTS_CACHE_TAG);
  }
  return {};
}

// Deletes your own review, with its image
export async function deleteReview(logId: string): Promise<{ error?: string }> {
  if (!isUuid(logId)) return { error: "Invalid entry." };

  const images = await postImageFiles("logs", logId, false);
  if (images.error) return { error: images.error };

  // Deleted as the signed-in user, so RLS decides who may
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("logs")
    .delete({ count: "exact" })
    .eq("id", logId);
  if (error) return { error: error.message };
  // Row-level security refuses silently when it isn't yours
  if (!count) return { error: "Couldn't delete that entry." };
  await deletePostImageFiles(images.files);
  return {};
}

// Deletes every file in someone's folder of a storage bucket, a page at a time
async function emptyStorageFolder(bucket: string, userId: string) {
  const storage = createAdminClient().storage.from(bucket);
  for (;;) {
    const { data: files } = await storage.list(userId, { limit: 1000 });
    if (!files || files.length === 0) return;
    const { error } = await storage.remove(
      files.map((f) => `${userId}/${f.name}`),
    );
    if (error) return;
  }
}

// Deletes someone's avatar and post image files and their auth user
async function removeAccount(userId: string): Promise<{ error?: string }> {
  // Deleting the auth user also deletes their profile, logs, favourites and
  // follows (the foreign keys use "on delete cascade")
  const admin = createAdminClient();
  await emptyStorageFolder("avatars", userId);
  for (const bucket of POST_IMAGE_BUCKETS) {
    await emptyStorageFolder(bucket, userId);
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };

  // Their posts are gone from the database, but the feeds, digest and
  // leaderboards keep a copy for a few minutes. Drop those copies now.
  updateTag(POSTS_CACHE_TAG);
  return {};
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

// The banned-email entry for an account, or null when it has no email
async function normalizedEmailOf(
  userId: string,
): Promise<{ email: string | null; error?: string }> {
  const admin = createAdminClient();
  const { data: target, error: lookupError } =
    await admin.auth.admin.getUserById(userId);
  if (lookupError) return { email: null, error: lookupError.message };
  if (!target.user.email) return { email: null };

  const { data: email, error } = await admin.rpc("normalize_email", {
    e: target.user.email,
  });
  if (error) return { email: null, error: error.message };
  return { email: email as string };
}

// Signs a person out for good, or lets them sign in again
async function setSignInBanned(
  userId: string,
  banned: boolean,
): Promise<{ error?: string }> {
  const { error } = await createAdminClient().auth.admin.updateUserById(
    userId,
    // About a hundred years, which is as long as a ban can be set for
    { ban_duration: banned ? "876000h" : "none" },
  );
  return error ? { error: error.message } : {};
}

// Deletes a comment the viewer wrote, or one on their review or list, along
// with its replies and the image files of them all
export async function deleteComment(
  table: CommentTable,
  commentId: string,
): Promise<{ error?: string }> {
  if (!COMMENT_TABLES.includes(table) || !isUuid(commentId)) {
    return { error: "Invalid comment." };
  }

  // Read first: once the comment is gone, so are its replies' rows
  const images = await postImageFiles(table, commentId, true);
  if (images.error) return { error: images.error };

  // Deleted as the signed-in user, so RLS decides who may
  const supabase = await createClient();
  const { error, count } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .eq("id", commentId);
  if (error) return { error: error.message };
  if (count) await deletePostImageFiles(images.files);
  return {};
}

// Admins only: hides the account and everything it posted, then blocks its
// email from signing up again and stops it signing in. Nothing is deleted.
export async function banUser(
  userId: string,
  input: ModerationInput,
): Promise<{ error?: string }> {
  if (!isUuid(userId)) return { error: "Invalid user." };
  if (!isReportReason(input.reason)) return { error: "Choose a reason." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_ban", {
    p_user_id: userId,
    p_reason: input.reason,
    p_note: cleanNote(input.note),
  });
  // Already banned means an earlier try got this far, so finish the rest
  if (error && error.message !== "That account is already banned") {
    return { error: error.message };
  }
  updateTag(POSTS_CACHE_TAG);

  // The database has checked this is an admin acting, so the rest can use the
  // secret key
  const { email, error: emailError } = await normalizedEmailOf(userId);
  if (emailError) return { error: `Banned, but ${emailError}` };
  if (email) {
    const { error: blockError } = await createAdminClient()
      .from("blocked_emails")
      .upsert({ email, reason: "banned" }, { ignoreDuplicates: true });
    if (blockError) return { error: `Banned, but ${blockError.message}` };
  }

  const signIn = await setSignInBanned(userId, true);
  if (signIn.error) return { error: `Banned, but ${signIn.error}` };
  return {};
}

// Admins only: lifts a ban, bringing back the posts it hid and letting the
// person sign in and use their email again
export async function unbanUser(
  userId: string,
  input: ModerationInput,
): Promise<{ error?: string }> {
  if (!isUuid(userId)) return { error: "Invalid user." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_unban", {
    p_user_id: userId,
    p_note: cleanNote(input.note),
  });
  // Not banned means an earlier try got this far, so finish the rest
  if (error && error.message !== "That account isn't banned") {
    return { error: error.message };
  }
  updateTag(POSTS_CACHE_TAG);

  const { email, error: emailError } = await normalizedEmailOf(userId);
  if (emailError) return { error: `Unbanned, but ${emailError}` };
  if (email) {
    const { error: unblockError } = await createAdminClient()
      .from("blocked_emails")
      .delete()
      .eq("email", email)
      .eq("reason", "banned");
    if (unblockError) {
      return { error: `Unbanned, but ${unblockError.message}` };
    }
  }

  const signIn = await setSignInBanned(userId, false);
  if (signIn.error) return { error: `Unbanned, but ${signIn.error}` };
  return {};
}

export async function signIn(input: {
  identifier: string;
  password: string;
  captchaToken?: string;
}): Promise<{ error?: string; userId?: string }> {
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
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
    options: { captchaToken: input.captchaToken },
  });
  if (error) {
    return {
      error: error.code === "invalid_credentials" ? generic : error.message,
    };
  }
  return { userId: data.user.id };
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

  const { error } = await withErrorContext(
    "favourite",
    {
      requestedItemId: input.itemId,
      itemId: stored.id,
      position: input.position,
    },
    () =>
      supabase
        .from("favourites")
        .upsert(
          { user_id: userId, position: input.position, item_id: stored.id },
          { onConflict: "user_id,position" },
        ),
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

// Stores an item (looked up on Wikipedia if need be) so it can go in a list
// that doesn't exist yet. Returns the stored item's ID, title and image.
export async function stageItem(itemId: string): Promise<{
  error?: string;
  item?: { itemId: string; title: string; imageUrl: string | null };
}> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: "You need to sign in." };
  if (!ITEM_ID.test(itemId)) return { error: "Invalid item." };

  const stored = await ensureItem(itemId);
  if ("error" in stored) return { error: stored.error };
  return {
    item: { itemId: stored.id, title: stored.title, imageUrl: stored.imageUrl },
  };
}

// Creates a list with all its items at once, so nobody sees it half-built.
// The items are in the order given. They must already be stored (stageItem).
export async function createList(input: {
  title: string;
  description: string;
  ranked: boolean;
  itemIds: string[];
}): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: "You need to sign in." };

  const title = input.title.trim();
  if (title.length < 1 || title.length > 80) {
    return { error: "Titles are 1–80 characters." };
  }
  const description = input.description.trim();
  if (description.length > 500) {
    return { error: "Descriptions are at most 500 characters." };
  }
  const itemIds = [...new Set(input.itemIds)];
  if (itemIds.length === 0) return { error: "Add at least one item." };
  if (
    itemIds.length > MAX_LIST_ITEMS ||
    !itemIds.every((id) => ITEM_ID.test(id))
  ) {
    return { error: "Invalid items." };
  }

  const { data: list, error } = await supabase
    .from("lists")
    .insert({
      user_id: userId,
      title,
      description: description || null,
      ranked: input.ranked,
    })
    .select("id")
    .single();
  if (error || !list) {
    return { error: error?.message ?? "Couldn't create the list." };
  }

  // One statement, so the items appear together
  const { error: itemsError } = await withErrorContext(
    "list_items",
    { listId: list.id, count: itemIds.length },
    () =>
      supabase.from("list_items").insert(
        itemIds.map((itemId, index) => ({
          list_id: list.id,
          item_id: itemId,
          position: index + 1,
        })),
      ),
  );
  if (itemsError) {
    await supabase.from("lists").delete().eq("id", list.id);
    return { error: itemsError.message };
  }
  return { id: list.id };
}

export async function addToList(input: {
  listId: string;
  itemId: string;
  // Ranked lists: the 1-based place to put the new item (otherwise it goes last)
  position?: number;
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
    input.position !== undefined &&
    (!Number.isInteger(input.position) ||
      input.position < 1 ||
      input.position > MAX_LIST_ITEMS)
  ) {
    return { error: "Invalid position." };
  }

  const { data: list, error: listError } = await supabase
    .from("lists")
    .select("id")
    .eq("id", input.listId)
    .eq("user_id", userId)
    .maybeSingle();
  if (listError)
    return { error: "Couldn't add to that list. Please try again." };
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

  const position = (last?.position ?? 0) + 1;
  const { error } = await withErrorContext(
    "list_item",
    {
      listId: input.listId,
      requestedItemId: input.itemId,
      itemId: stored.id,
      position,
    },
    () =>
      supabase.from("list_items").insert({
        list_id: input.listId,
        item_id: stored.id,
        position,
      }),
  );
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "That item is already in this list."
          : error.message,
    };
  }

  // Ranked lists: move the new item into the place the user chose
  if (input.position !== undefined && input.position < position) {
    const { error: moveError } = await supabase.rpc("move_list_item", {
      p_list: input.listId,
      p_item: stored.id,
      p_position: input.position,
    });
    if (moveError) return { error: moveError.message };
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
