// ABOUTME: Changes to your own logs, made from the browser.
// ABOUTME: Returns an error message, or null on success.

import {
  SAVE_FAILED,
  userFacingErrorMessage,
} from "@/lib/errors/userFacingErrorMessage";
import { hasLogContent, NEEDS_CONTENT } from "@/lib/logContent";
import { createClient } from "@/lib/supabase/client";

export async function updateLog(
  logId: string,
  rating: number | null,
  review: string,
): Promise<string | null> {
  if (!hasLogContent(rating, review)) return NEEDS_CONTENT;
  const { error } = await createClient()
    .from("logs")
    .update({ rating, review: review.slice(0, 5000) })
    .eq("id", logId);
  return error ? userFacingErrorMessage(error, SAVE_FAILED) : null;
}
