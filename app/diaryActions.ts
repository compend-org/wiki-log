// ABOUTME: Server action that loads the later pages of the signed-in person's diary.
// ABOUTME: Checks what the browser sent and who is signed in, then renders the page's cards.
"use server";

import type { CardsPage } from "@/components/CardPages";
import {
  type DiaryCursor,
  loadDiaryPage,
  parseDiaryCursor,
} from "@/components/loadDiaryPage";
import { createClient } from "@/lib/supabase/server";

export async function loadMoreDiary(
  cursor: unknown,
): Promise<CardsPage<DiaryCursor>> {
  const after = parseDiaryCursor(cursor);
  if (!after) throw new Error("That isn't a page of a diary.");
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) throw new Error("Sign in to see your diary.");
  return loadDiaryPage(supabase, userId, after);
}
