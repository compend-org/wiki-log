// ABOUTME: Server actions for accounts, logs, favourites, lists and compounds.
// ABOUTME: Caches items looked up from Wikipedia before anything refers to them.
"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  cleanNote,
  isReportReason,
  type ModerationInput,
} from "@/lib/admin/moderation";
import { chunks } from "@/lib/allRows";
import { POSTS_CACHE_TAG } from "@/lib/cacheTags";
import {
  prepareCompoundImage,
  removeCompoundImage,
  replaceCompoundImage,
  storeCompoundImage,
} from "@/lib/craft/compoundImage";
import { withErrorContext } from "@/lib/errors/errorContext";
import {
  authMessage,
  SAVE_FAILED,
  userFacingErrorMessage,
} from "@/lib/errors/userFacingErrorMessage";
import { FEATURES } from "@/lib/features";
import { ITEM_ID_PATTERN, isCompoundId, isUuid } from "@/lib/ids";
import {
  applyImageHidden,
  itemColumns,
  MAX_AGE_MS,
  replaceBrokenImage,
  STALE_COPY_WAIT_MS,
} from "@/lib/items";
import { MAX_GROUPED_ITEMS, MAX_GROUPS } from "@/lib/lists/listGroups";
import { cleanListNote, noteProblem } from "@/lib/lists/listNotes";
import { hasLogContent, NEEDS_CONTENT } from "@/lib/logContent";
import {
  type PictureChoice,
  pictureChoices,
  storedPicture,
} from "@/lib/pictureChoices";
import { parseSfwMode, type SfwMode } from "@/lib/sfw";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cleanName, isValidName } from "@/lib/username";
import { getItemById } from "@/lib/wikipedia/wikipedia";

const ITEM_ID = ITEM_ID_PATTERN;
// Matches limit_list_counts() in supabase/migrations/*_raise_list_limits.sql
const MAX_LIST_ITEMS = 10000;
// How many of a new list's pictures are checked or saved at once, so a long
// list can't start thousands of requests together
const PICTURES_AT_ONCE = 10;

// A stored item's ID, title and image, or why it couldn't be stored
type StoredItem =
  | { error: string }
  | { id: string; title: string; imageUrl: string | null };

// Looks the item up on Wikipedia and Wikidata and caches it
// (users can't write to `items` themselves)
async function ensureItem(itemId: string): Promise<StoredItem> {
  const t = await getTranslations();
  // Compounds only exist in our own database
  if (isCompoundId(itemId)) {
    const { data } = await createAdminClient()
      .from("items")
      .select("title, image_url")
      .eq("id", itemId)
      .maybeSingle();
    return data
      ? { id: itemId, title: data.title, imageUrl: data.image_url }
      : { error: t("errors.thatCompoundDoesnTExist") };
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
  // A failed image lookup left the stored image in place
  const imageUrl =
    item.imageLookupFailed && existing ? existing.image_url : item.imageUrl;
  return error
    ? { error: userFacingErrorMessage(error, SAVE_FAILED) }
    : { id: item.id, title: item.title, imageUrl };
}

// For an item image the browser couldn't load: the image to show instead, if any
export async function reportBrokenImage(url: string): Promise<string | null> {
  if (typeof url !== "string") return null;
  return replaceBrokenImage(url);
}

export async function logItem(input: {
  itemId: string;
  rating: number | null;
  review: string;
  // A picture from the item's article to show instead of the item's own
  imageUrl?: string | null;
}): Promise<{ error?: string }> {
  const t = await getTranslations();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: t("errors.signInToLog") };

  if (!ITEM_ID.test(input.itemId)) return { error: t("errors.invalidItem") };
  if (
    input.rating !== null &&
    (!Number.isFinite(input.rating) ||
      input.rating < 0.5 ||
      input.rating > 5 ||
      (input.rating * 2) % 1 !== 0)
  ) {
    return { error: t("errors.invalidRating") };
  }

  if (!hasLogContent(input.rating, input.review)) {
    return { error: NEEDS_CONTENT };
  }

  // The server looks the item up itself instead of trusting the browser
  const stored = await ensureItem(input.itemId);
  if ("error" in stored) return { error: stored.error };

  // Checked before saving, so a picture that isn't allowed saves nothing
  const picture = await storedPicture(stored.id, input.imageUrl ?? null);
  if ("error" in picture) return picture;

  // Saved as the signed-in user, so RLS applies
  const { data: saved, error } = await withErrorContext(
    "log",
    { requestedItemId: input.itemId, itemId: stored.id },
    () =>
      supabase
        .from("logs")
        .insert({
          user_id: userId,
          item_id: stored.id,
          rating: input.rating,
          review: input.review.slice(0, 5000),
        })
        .select("id"),
  );
  if (error) return { error: userFacingErrorMessage(error, SAVE_FAILED) };

  // Only the server may set a review's picture
  const logId = saved?.[0]?.id;
  if (picture.url && logId) {
    const { error: pictureError } = await createAdminClient()
      .from("logs")
      .update({ image_url: picture.url })
      .eq("id", logId);
    if (pictureError) {
      // The entry goes too, so trying again can't log it twice
      const { error: undoError } = await supabase
        .from("logs")
        .delete()
        .eq("id", logId);
      return {
        error: undoError
          ? t("errors.entrySavedNoPicture")
          : t("errors.entrySaveFailed"),
      };
    }
  }

  return {};
}

// True if the account is banned or suspended. The database stops such
// accounts writing for themselves; this covers writes the server makes for them.
async function accountIsRestricted(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("banned_at, account_restrictions(suspended_until)")
    .eq("id", userId)
    .maybeSingle();
  const row = data as {
    banned_at: string | null;
    account_restrictions: { suspended_until: string } | null;
  } | null;
  if (!row) return true;
  const until = row.account_restrictions?.suspended_until;
  return (
    row.banned_at !== null ||
    (!!until && new Date(until).getTime() > Date.now())
  );
}

// The pictures a review of this item can show, the item's own first
export async function itemPictureChoices(
  itemId: string,
): Promise<{ choices: PictureChoice[] } | { error: string }> {
  const t = await getTranslations();
  if (typeof itemId !== "string" || !ITEM_ID.test(itemId)) {
    return { error: t("errors.invalidItem") };
  }
  const choices = await pictureChoices(itemId);
  return choices ? { choices } : { error: t("errors.wikipediaUnreachable") };
}

// Sets the picture one of your reviews shows. Null goes back to the item's own.
export async function setReviewPicture(
  logId: string,
  imageUrl: string | null,
): Promise<{ error?: string }> {
  const t = await getTranslations();
  if (!isUuid(logId)) return { error: t("errors.invalidReview") };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: t("errors.signInRequired") };
  if (await accountIsRestricted(supabase, userId)) {
    return { error: t("errors.accountSuspended") };
  }

  const { data: log } = await supabase
    .from("logs")
    .select("item_id")
    .eq("id", logId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!log) return { error: t("errors.saveChange") };

  const picture = await storedPicture(log.item_id, imageUrl);
  if ("error" in picture) return picture;

  const { error } = await createAdminClient()
    .from("logs")
    .update({ image_url: picture.url })
    .eq("id", logId)
    .eq("user_id", userId);
  return error ? { error: userFacingErrorMessage(error, SAVE_FAILED) } : {};
}

// Sets the picture an item shows in one of your lists. Null goes back to the
// item's own.
export async function setListItemPicture(
  listId: string,
  itemId: string,
  imageUrl: string | null,
): Promise<{ error?: string }> {
  const t = await getTranslations();
  if (!isUuid(listId)) return { error: t("errors.invalidList") };
  if (typeof itemId !== "string" || !ITEM_ID.test(itemId)) {
    return { error: t("errors.invalidItem") };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: t("errors.signInRequired") };
  if (await accountIsRestricted(supabase, userId)) {
    return { error: t("errors.accountSuspended") };
  }

  const { data: entry } = await supabase
    .from("list_items")
    .select("item_id, lists!inner(user_id)")
    .eq("list_id", listId)
    .eq("item_id", itemId)
    .eq("lists.user_id", userId)
    .maybeSingle();
  if (!entry) return { error: t("errors.saveChange") };

  const picture = await storedPicture(itemId, imageUrl);
  if ("error" in picture) return picture;

  const { error } = await createAdminClient()
    .from("list_items")
    .update({ image_url: picture.url })
    .eq("list_id", listId)
    .eq("item_id", itemId);
  return error ? { error: userFacingErrorMessage(error, SAVE_FAILED) } : {};
}

// Sets why an item is on one of your lists. Null, or only spaces, removes the
// note.
export async function setListItemNote(
  listId: string,
  itemId: string,
  note: string | null,
): Promise<{ error?: string }> {
  const t = await getTranslations();
  if (!isUuid(listId)) return { error: t("errors.invalidList") };
  if (typeof itemId !== "string" || !ITEM_ID.test(itemId)) {
    return { error: t("errors.invalidItem") };
  }
  if (note !== null && typeof note !== "string") {
    return { error: t("errors.invalidNote") };
  }
  const problem = note === null ? null : noteProblem(note);
  if (problem) return { error: problem };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: t("errors.signInRequired") };

  // The database lets only the list's owner change its items, and not while
  // their account is suspended
  const { data: updated, error } = await supabase
    .from("list_items")
    .update({ note: note === null ? null : cleanListNote(note) })
    .eq("list_id", listId)
    .eq("item_id", itemId)
    .select("item_id");
  if (error) return { error: userFacingErrorMessage(error, SAVE_FAILED) };
  if (!updated?.length) return { error: t("errors.saveChange") };
  return {};
}

// Deletes someone's avatar files and their auth user
async function removeAccount(userId: string): Promise<{ error?: string }> {
  const t = await getTranslations();
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
  if (error) {
    return { error: authMessage(error, t("errors.deleteAccountFailed")) };
  }

  // Their posts are gone from the database, but the feeds, digest and
  // leaderboards keep a copy for a few minutes. Drop those copies now.
  updateTag(POSTS_CACHE_TAG);
  return {};
}

export async function deleteAccount(): Promise<{ error?: string }> {
  const t = await getTranslations();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: t("errors.signedInRequired") };

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

// Admins only: hides the account and everything it posted, then blocks its
// email from signing up again and stops it signing in. Nothing is deleted.
export async function banUser(
  userId: string,
  input: ModerationInput,
): Promise<{ error?: string }> {
  const t = await getTranslations();
  if (!isUuid(userId)) return { error: t("errors.invalidUser") };
  if (!isReportReason(input.reason)) return { error: t("errors.chooseReason") };

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
  const t = await getTranslations();
  if (!isUuid(userId)) return { error: t("errors.invalidUser") };

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
}): Promise<{ error?: string; userId?: string; sfwMode?: SfwMode }> {
  const t = await getTranslations();
  const generic = t("errors.signInInvalid");
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
      error:
        error.code === "invalid_credentials"
          ? generic
          : authMessage(error, t("errors.signInFailed")),
    };
  }
  // The account's SFW mode, so the browser applies it from the first page on
  const { data: settings } = await supabase
    .from("user_settings")
    .select("sfw_mode")
    .eq("user_id", data.user.id)
    .maybeSingle();
  return { userId: data.user.id, sfwMode: parseSfwMode(settings?.sfw_mode) };
}

export async function setFavourite(input: {
  position: number;
  itemId: string;
}): Promise<{ error?: string }> {
  const t = await getTranslations();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: t("errors.signInRequired") };

  if (
    !Number.isInteger(input.position) ||
    input.position < 1 ||
    input.position > 5
  ) {
    return { error: t("errors.invalidSlot") };
  }
  if (!ITEM_ID.test(input.itemId)) return { error: t("errors.invalidItem") };
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
          ? t("errors.topFiveDuplicate")
          : userFacingErrorMessage(error, SAVE_FAILED),
    };
  }
  return {};
}

// Sets the picture an item shows in your top 5. Null goes back to the item's
// own. `itemId` is the item the picture was picked for, so a slot that has
// since been given another item is left alone.
export async function setFavouritePicture(
  position: number,
  itemId: string,
  imageUrl: string | null,
): Promise<{ error?: string }> {
  const t = await getTranslations();
  if (!Number.isInteger(position) || position < 1 || position > 5) {
    return { error: t("errors.invalidSlot") };
  }
  if (typeof itemId !== "string" || !ITEM_ID.test(itemId)) {
    return { error: t("errors.invalidItem") };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: t("errors.signInRequired") };
  if (await accountIsRestricted(supabase, userId)) {
    return { error: t("errors.accountSuspended") };
  }

  const picture = await storedPicture(itemId, imageUrl);
  if ("error" in picture) return picture;

  const { data: updated, error } = await createAdminClient()
    .from("favourites")
    .update({ image_url: picture.url })
    .eq("user_id", userId)
    .eq("position", position)
    .eq("item_id", itemId)
    .select("position");
  if (error) return { error: userFacingErrorMessage(error, SAVE_FAILED) };
  return updated?.length ? {} : { error: t("errors.slotChanged") };
}

export async function removeFavourite(
  position: number,
): Promise<{ error?: string }> {
  const t = await getTranslations();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: t("errors.signInRequired") };

  const { error } = await supabase
    .from("favourites")
    .delete()
    .eq("user_id", userId)
    .eq("position", position);
  return error ? { error: userFacingErrorMessage(error, SAVE_FAILED) } : {};
}

// Stores an item (looked up on Wikipedia if need be) so it can go in a list
// that doesn't exist yet. Returns the stored item's ID, title and image.
export async function stageItem(itemId: string): Promise<{
  error?: string;
  item?: { itemId: string; title: string; imageUrl: string | null };
}> {
  const t = await getTranslations();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: t("errors.signInRequired") };
  if (!ITEM_ID.test(itemId)) return { error: t("errors.invalidItem") };

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
  // Pictures from the items' articles to show instead of the items' own, by
  // item
  pictures?: Record<string, string>;
  // Why each item is on the list, by item, for the items that have a note
  notes?: Record<string, string>;
}): Promise<{ error?: string; id?: string }> {
  const t = await getTranslations();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: t("errors.signInRequired") };

  const title = input.title.trim();
  if (title.length < 1 || title.length > 80) {
    return { error: t("errors.titleLength") };
  }
  const description = input.description.trim();
  if (description.length > 500) {
    return { error: t("errors.descriptionLength") };
  }
  const itemIds = [...new Set(input.itemIds)];
  if (itemIds.length === 0) return { error: t("errors.addAtLeastOne") };
  if (
    itemIds.length > MAX_LIST_ITEMS ||
    !itemIds.every((id) => ITEM_ID.test(id))
  ) {
    return { error: t("errors.invalidItems") };
  }

  const notes = new Map<string, string>();
  for (const [itemId, text] of Object.entries(input.notes ?? {})) {
    if (!itemIds.includes(itemId) || typeof text !== "string") {
      return { error: t("errors.invalidNotes") };
    }
    const problem = noteProblem(text);
    if (problem) return { error: problem };
    const note = cleanListNote(text);
    if (note) notes.set(itemId, note);
  }

  // Checked before saving, so a picture that isn't allowed saves nothing
  const chosen = Object.entries(input.pictures ?? {});
  if (chosen.some(([itemId]) => !itemIds.includes(itemId))) {
    return { error: t("errors.invalidPictures") };
  }
  const pictures: { itemId: string; url: string }[] = [];
  for (const batch of chunks(chosen, PICTURES_AT_ONCE)) {
    const checked = await Promise.all(
      batch.map(([itemId, url]) => storedPicture(itemId, url)),
    );
    for (const [index, picture] of checked.entries()) {
      if ("error" in picture) return picture;
      if (picture.url) {
        pictures.push({ itemId: batch[index][0], url: picture.url });
      }
    }
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
    return {
      error: error
        ? userFacingErrorMessage(error, t("errors.listCreateFailed"))
        : t("errors.listCreateFailed"),
    };
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
          note: notes.get(itemId) ?? null,
        })),
      ),
  );
  if (itemsError) {
    await supabase.from("lists").delete().eq("id", list.id);
    return {
      error: userFacingErrorMessage(itemsError, t("errors.listCreateFailed")),
    };
  }

  // Only the server may set an entry's picture
  const admin = createAdminClient();
  for (const batch of chunks(pictures, PICTURES_AT_ONCE)) {
    const writes = await Promise.all(
      batch.map((p) =>
        admin
          .from("list_items")
          .update({ image_url: p.url })
          .eq("list_id", list.id)
          .eq("item_id", p.itemId),
      ),
    );
    if (writes.some((w) => w.error)) {
      // The list goes too, so trying again can't create it twice
      const { error: undoError } = await supabase
        .from("lists")
        .delete()
        .eq("id", list.id);
      return {
        error: undoError
          ? t("errors.listCreatedPicturesFailed")
          : t("errors.listCreateRetry"),
      };
    }
  }
  return { id: list.id };
}

// Creates a grouped list with its groups and items at once. The items must
// already be stored (stageItem). Each group is { name, itemIds } in the order
// to show them; names are used only when the list is labeled.
export async function createGroupedList(input: {
  title: string;
  description: string;
  labeled: boolean;
  groups: { name: string | null; items: string[] }[];
  // Pictures from the items' articles to show instead of the items' own, by
  // item
  pictures?: Record<string, string>;
}): Promise<{ error?: string; id?: string }> {
  const t = await getTranslations();
  if (!FEATURES.groupedLists) return { error: t("errors.groupedListsOff") };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: t("errors.signInRequired") };

  const title = input.title.trim();
  if (title.length < 1 || title.length > 80) {
    return { error: t("errors.titleLength") };
  }
  const description = input.description.trim();
  if (description.length > 500) {
    return { error: t("errors.descriptionLength") };
  }
  if (
    !Array.isArray(input.groups) ||
    input.groups.length < 1 ||
    input.groups.length > MAX_GROUPS ||
    !input.groups.every(
      (g) => Array.isArray(g.items) && g.items.every((id) => ITEM_ID.test(id)),
    )
  ) {
    return { error: t("errors.invalidGroups") };
  }
  const itemIds = input.groups.flatMap((g) => g.items);
  if (itemIds.length < 1) return { error: t("errors.addAtLeastOne") };

  // Checked before saving, so a picture that isn't allowed saves nothing
  const chosen = Object.entries(input.pictures ?? {});
  if (chosen.some(([itemId]) => !itemIds.includes(itemId))) {
    return { error: t("errors.invalidPictures") };
  }
  const pictures: { itemId: string; url: string }[] = [];
  for (const batch of chunks(chosen, PICTURES_AT_ONCE)) {
    const checked = await Promise.all(
      batch.map(([itemId, url]) => storedPicture(itemId, url)),
    );
    for (const [index, picture] of checked.entries()) {
      if ("error" in picture) return picture;
      if (picture.url) {
        pictures.push({ itemId: batch[index][0], url: picture.url });
      }
    }
  }

  const { data: list, error } = await supabase
    .from("lists")
    .insert({
      user_id: userId,
      title,
      description: description || null,
      ranked: false,
      grouped: true,
      group_labels: input.labeled,
    })
    .select("id")
    .single();
  if (error || !list) {
    return {
      error: error
        ? userFacingErrorMessage(error, t("errors.listCreateFailed"))
        : t("errors.listCreateFailed"),
    };
  }

  // The groups and items go in together, so nobody sees it half-built
  const { error: groupsError } = await withErrorContext(
    "list_groups",
    { listId: list.id, count: input.groups.length },
    () =>
      supabase.rpc("set_list_groups", {
        p_list: list.id,
        p_groups: input.groups,
      }),
  );
  if (groupsError) {
    await supabase.from("lists").delete().eq("id", list.id);
    return {
      error: userFacingErrorMessage(groupsError, t("errors.listCreateFailed")),
    };
  }
  // Only the server may set an entry's picture
  const admin = createAdminClient();
  for (const batch of chunks(pictures, PICTURES_AT_ONCE)) {
    const writes = await Promise.all(
      batch.map((p) =>
        admin
          .from("list_items")
          .update({ image_url: p.url })
          .eq("list_id", list.id)
          .eq("item_id", p.itemId),
      ),
    );
    if (writes.some((w) => w.error)) {
      // The list goes too, so trying again can't create it twice
      const { error: undoError } = await supabase
        .from("lists")
        .delete()
        .eq("id", list.id);
      return {
        error: undoError
          ? t("errors.listCreatedPicturesFailed")
          : t("errors.listCreateRetry"),
      };
    }
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
  const t = await getTranslations();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: t("errors.signInRequired") };

  if (!isUuid(input.listId)) return { error: t("errors.invalidList") };
  if (!ITEM_ID.test(input.itemId)) return { error: t("errors.invalidItem") };
  if (
    input.position !== undefined &&
    (!Number.isInteger(input.position) ||
      input.position < 1 ||
      input.position > MAX_LIST_ITEMS)
  ) {
    return { error: t("errors.invalidPosition") };
  }

  const { data: list, error: listError } = await supabase
    .from("lists")
    .select("id, grouped")
    .eq("id", input.listId)
    .eq("user_id", userId)
    .maybeSingle();
  if (listError) return { error: t("errors.addToListFailed") };
  if (!list) return { error: t("errors.notYourList") };

  // A grouped list's new items go in its last group, and it holds fewer items
  // than a plain one
  let groupId: string | null = null;
  if (list.grouped && FEATURES.groupedLists) {
    const [{ data: lastGroup }, { count }] = await Promise.all([
      supabase
        .from("list_groups")
        .select("id")
        .eq("list_id", input.listId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("list_items")
        .select("item_id", { count: "exact", head: true })
        .eq("list_id", input.listId),
    ]);
    if ((count ?? 0) >= MAX_GROUPED_ITEMS) {
      return {
        error: `A grouped list can hold at most ${MAX_GROUPED_ITEMS} items.`,
      };
    }
    groupId = lastGroup?.id ?? null;
  }

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
        ...(groupId ? { group_id: groupId } : {}),
      }),
  );
  if (error) {
    return {
      error:
        error.code === "23505"
          ? t("errors.alreadyInList")
          : userFacingErrorMessage(error, SAVE_FAILED),
    };
  }

  // Ranked lists: move the new item into the place the user chose
  if (input.position !== undefined && input.position < position) {
    const { error: moveError } = await supabase.rpc("move_list_item", {
      p_list: input.listId,
      p_item: stored.id,
      p_position: input.position,
    });
    if (moveError)
      return { error: userFacingErrorMessage(moveError, SAVE_FAILED) };
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
  image?: string | null;
}): Promise<{
  id?: string;
  existing?: { id: string; title: string };
  error?: string;
}> {
  const t = await getTranslations();
  if (!FEATURES.compounds) return { error: t("errors.craftingIsTurnedOff") };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: t("errors.youNeedToSignIn") };

  const title = input.title.trim().replace(/\s+/g, " ");
  const description = input.description.trim();
  if (title.length < 1 || title.length > 80) {
    return { error: t("errors.namesAre180Characters") };
  }
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the purpose of this check
  if (/[\u0000-\u001f]/.test(title)) {
    return { error: t("errors.thatNameHasInvalidCharacters") };
  }
  if (description.length > 500) {
    return { error: t("errors.descriptionLength") };
  }

  let image: Buffer | null = null;
  if (input.image) {
    const prepared = await prepareCompoundImage(input.image);
    if ("error" in prepared) return { error: prepared.error };
    image = prepared.png;
  }

  const parts = input.parts;
  if (!Array.isArray(parts) || parts.length < 2 || parts.length > 8) {
    return { error: t("errors.aCompoundNeeds2To") };
  }
  if (!parts.every((p) => typeof p === "string" && ITEM_ID.test(p))) {
    return { error: t("errors.invalidIngredient") };
  }
  if (new Set(parts).size !== parts.length) {
    return { error: t("errors.eachIngredientCanOnlyBe") };
  }

  // Make sure every ingredient is stored in the database
  const stored = await Promise.all(parts.map((p) => ensureItem(p)));
  const resolvedParts: string[] = [];
  for (const part of stored) {
    if ("error" in part) return { error: part.error };
    resolvedParts.push(part.id);
  }
  if (new Set(resolvedParts).size !== resolvedParts.length) {
    return { error: t("errors.eachIngredientCanOnlyBe") };
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
  if (error) return { error: userFacingErrorMessage(error, SAVE_FAILED) };

  const r = result as { id: string; title: string; existing: boolean };
  // Whoever made it first keeps their picture. A compound that loses its
  // picture is undone, so crafting again with the same drawing can succeed.
  // One that can't be undone stays without a picture, which editing it adds.
  if (image && !r.existing && !(await storeCompoundImage(r.id, image))) {
    const { error: undoError } = await createAdminClient()
      .from("items")
      .delete()
      .eq("id", r.id);
    await removeCompoundImage(r.id);
    return {
      error: undoError
        ? "Crafted it, but the picture couldn't be saved. Edit it to add the picture."
        : "The picture couldn't be saved. Try crafting again.",
    };
  }

  return r.existing ? { existing: { id: r.id, title: r.title } } : { id: r.id };
}

// A compound's own details, as shown after someone edits them
export type CompoundDetails = {
  title: string;
  description: string;
  imageUrl: string | null;
};

// Only the person who crafted a compound may change or delete it
async function ownCompound(
  compoundId: string,
): Promise<{ error: string } | { userId: string }> {
  const t = await getTranslations();
  if (!FEATURES.compounds) return { error: t("errors.craftingIsTurnedOff") };
  if (typeof compoundId !== "string" || !isCompoundId(compoundId)) {
    return { error: t("errors.thatIsnTACompound") };
  }
  const { data } = await (await createClient()).auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return { error: t("errors.signInRequired") };
  const { data: row } = await createAdminClient()
    .from("compounds")
    .select("creator_id")
    .eq("item_id", compoundId)
    .maybeSingle();
  if (!row) return { error: t("errors.thatCompoundDoesnTExist") };
  if (row.creator_id !== userId) {
    return { error: t("errors.onlyThePersonWhoCrafted") };
  }
  return { userId };
}

// Changes a compound's name, description and picture, never its ingredients.
// `image` is left out to keep the picture, null to remove it, or a PNG data URL.
export async function updateCompound(input: {
  id: string;
  title: string;
  description: string;
  image?: string | null;
}): Promise<{ error: string } | { details: CompoundDetails }> {
  const t = await getTranslations();
  const owner = await ownCompound(input.id);
  if ("error" in owner) return owner;

  const title = String(input.title ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const description = String(input.description ?? "").trim();
  if (title.length < 1 || title.length > 80) {
    return { error: t("errors.namesAre180Characters") };
  }
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the purpose of this check
  if (/[\u0000-\u001f]/.test(title)) {
    return { error: t("errors.thatNameHasInvalidCharacters") };
  }
  if (description.length > 500) {
    return { error: t("errors.descriptionLength") };
  }
  let png: Buffer | null = null;
  if (typeof input.image === "string") {
    const picture = await prepareCompoundImage(input.image);
    if ("error" in picture) return picture;
    png = picture.png;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("items")
    .update({ title, description: description || null })
    .eq("id", input.id);
  if (error) return { error: userFacingErrorMessage(error, SAVE_FAILED) };

  let imageUrl: string | null | undefined;
  if (png) {
    imageUrl = await replaceCompoundImage(input.id, png);
    if (imageUrl === null) {
      return { error: t("errors.savedTheTextButThe") };
    }
  } else if (input.image === null) {
    const { error: unlinkError } = await admin
      .from("items")
      .update({ image_url: null })
      .eq("id", input.id);
    if (unlinkError) {
      return { error: t("errors.savedTheTextButThe2") };
    }
    await removeCompoundImage(input.id);
    imageUrl = null;
  }
  if (imageUrl === undefined) {
    const { data } = await admin
      .from("items")
      .select("image_url")
      .eq("id", input.id)
      .maybeSingle();
    imageUrl = data?.image_url ?? null;
  }

  updateTag(POSTS_CACHE_TAG);
  return { details: { title, description, imageUrl: imageUrl ?? null } };
}

// Deletes a compound. That isn't possible once anything refers to it: a log, a
// list, a favourite, or another compound made from it.
export async function deleteCompound(
  compoundId: string,
): Promise<{ error?: string }> {
  const owner = await ownCompound(compoundId);
  if ("error" in owner) return owner;

  const { error } = await createAdminClient()
    .from("items")
    .delete()
    .eq("id", compoundId);
  if (error) {
    // 23503: something still refers to it
    return {
      error:
        error.code === "23503"
          ? "It's been logged, listed, favourited or used in another compound, so it can't be deleted. You can still edit it."
          : userFacingErrorMessage(
              error,
              "Couldn't delete it. Please try again.",
            ),
    };
  }
  await removeCompoundImage(compoundId);
  updateTag(POSTS_CACHE_TAG);
  return {};
}
