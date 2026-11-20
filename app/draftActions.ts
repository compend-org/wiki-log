// ABOUTME: Server actions that store and delete the signed-in person's drafts of log entries and lists.
// ABOUTME: Each save names the version it replaces, so a stale tab can't overwrite newer work.
"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getTranslations } from "next-intl/server";
import { stageItem } from "@/app/actions";
import type { DraftSaveResult, ListDraftFields } from "@/lib/drafts";
import { listDraftProblem } from "@/lib/drafts";
import {
  SAVE_FAILED,
  userFacingErrorMessage,
} from "@/lib/errors/userFacingErrorMessage";
import { ITEM_ID_PATTERN, isUuid } from "@/lib/ids";
import { isValidRating } from "@/lib/ratings";
import { createClient } from "@/lib/supabase/server";

async function signedIn(): Promise<{
  supabase: SupabaseClient;
  userId: string | undefined;
}> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub };
}

function isSavedAt(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.length < 64);
}

// Stores `row` as the draft `match` picks out. With no `savedAt` the draft is
// new; otherwise it must still be the version saved then.
async function storeDraft(
  supabase: SupabaseClient,
  table: "log_drafts" | "list_drafts",
  match: Record<string, string>,
  row: Record<string, unknown>,
  savedAt: string | null,
): Promise<DraftSaveResult> {
  const values = { ...row, saved_at: new Date().toISOString() };
  if (savedAt === null) {
    const { data, error } = await supabase
      .from(table)
      .insert({ ...match, ...values })
      .select("saved_at")
      .single();
    // Another tab started this draft first
    if (error?.code === "23505") return { conflict: true };
    if (error || !data) {
      return { error: userFacingErrorMessage(error, SAVE_FAILED) };
    }
    return { savedAt: data.saved_at };
  }
  let update = supabase.from(table).update(values).eq("saved_at", savedAt);
  for (const [column, value] of Object.entries(match)) {
    update = update.eq(column, value);
  }
  const { data, error } = await update.select("saved_at");
  if (error) return { error: userFacingErrorMessage(error, SAVE_FAILED) };
  // Saved again or deleted elsewhere since
  if (!data || data.length === 0) return { conflict: true };
  return { savedAt: data[0].saved_at };
}

// Deletes the draft `match` picks out, if it is still the version saved at
// `savedAt`
async function deleteDraft(
  table: "log_drafts" | "list_drafts",
  match: Record<string, string>,
  savedAt: unknown,
): Promise<{ error?: string }> {
  const t = await getTranslations();
  const { supabase, userId } = await signedIn();
  if (!userId) return { error: t("errors.signInRequired") };
  if (typeof savedAt !== "string" || !isSavedAt(savedAt)) {
    return { error: t("errors.invalidDraft") };
  }
  let query = supabase
    .from(table)
    .delete()
    .eq("user_id", userId)
    .eq("saved_at", savedAt);
  for (const [column, value] of Object.entries(match)) {
    query = query.eq(column, value);
  }
  const { data, error } = await query.select("saved_at");
  if (error) return { error: userFacingErrorMessage(error, SAVE_FAILED) };
  if (!data || data.length === 0) {
    return { error: t("drafts.changedElsewhere") };
  }
  return {};
}

// Stores the log entry being written for an item. The first save stores the
// item too, as logging it would.
export async function saveLogDraft(input: {
  itemId: string;
  rating: number | null;
  review: string;
  imageUrl: string | null;
  imageFilePage: string | null;
  savedAt: string | null;
}): Promise<DraftSaveResult> {
  const t = await getTranslations();
  const { supabase, userId } = await signedIn();
  if (!userId) return { error: t("errors.signInRequired") };
  if (
    typeof input.itemId !== "string" ||
    !ITEM_ID_PATTERN.test(input.itemId) ||
    !isValidRating(input.rating) ||
    typeof input.review !== "string" ||
    !isSavedAt(input.savedAt) ||
    !(input.imageUrl === null || typeof input.imageUrl === "string") ||
    !(input.imageFilePage === null || typeof input.imageFilePage === "string")
  ) {
    return { error: t("errors.invalidDraft") };
  }

  let itemId = input.itemId;
  if (input.savedAt === null) {
    const staged = await stageItem(itemId);
    if (staged.error || !staged.item) {
      return { error: staged.error ?? SAVE_FAILED };
    }
    itemId = staged.item.itemId;
  }
  return storeDraft(
    supabase,
    "log_drafts",
    { user_id: userId, item_id: itemId },
    {
      rating: input.rating,
      review: input.review.slice(0, 5000),
      image_url: input.imageUrl?.slice(0, 2000) ?? null,
      image_file_page: input.imageFilePage?.slice(0, 2000) ?? null,
    },
    input.savedAt,
  );
}

export async function deleteLogDraft(input: {
  itemId: string;
  savedAt: string;
}): Promise<{ error?: string }> {
  if (typeof input.itemId !== "string" || !ITEM_ID_PATTERN.test(input.itemId)) {
    return { error: (await getTranslations())("errors.invalidItem") };
  }
  return deleteDraft("log_drafts", { item_id: input.itemId }, input.savedAt);
}

// Stores a list being made. Its ID is chosen by the editor before the first
// save, so every save from that editor goes to the same draft.
export async function saveListDraft(
  input: ListDraftFields & { id: string; savedAt: string | null },
): Promise<DraftSaveResult> {
  const t = await getTranslations();
  const { supabase, userId } = await signedIn();
  if (!userId) return { error: t("errors.signInRequired") };
  if (
    typeof input.id !== "string" ||
    !isUuid(input.id) ||
    !isSavedAt(input.savedAt)
  ) {
    return { error: t("errors.invalidDraft") };
  }
  const problem = listDraftProblem(input);
  if (problem) return { error: t(`errors.${problem}`) };

  return storeDraft(
    supabase,
    "list_drafts",
    { id: input.id, user_id: userId },
    {
      grouped: input.grouped,
      title: input.title,
      description: input.description,
      ranked: input.ranked,
      labeled: input.labeled,
      content: input.content,
    },
    input.savedAt,
  );
}

export async function deleteListDraft(input: {
  id: string;
  savedAt: string;
}): Promise<{ error?: string }> {
  if (typeof input.id !== "string" || !isUuid(input.id)) {
    return { error: (await getTranslations())("errors.invalidDraft") };
  }
  return deleteDraft("list_drafts", { id: input.id }, input.savedAt);
}
