// ABOUTME: Server action that loads the later pages of the signed-in person's diary.
// ABOUTME: Checks what the browser sent and who is signed in, then renders the page's cards.
"use server";

import { getTranslations } from "next-intl/server";
import {
  type DiaryCursor,
  loadDiaryPage,
  parseDiaryCursor,
} from "@/components/activity/loadDiaryPage";
import type { CardsPage } from "@/components/paging/CardPages";
import { createClient } from "@/lib/supabase/server";

export async function loadMoreDiary(
  cursor: unknown,
): Promise<CardsPage<DiaryCursor>> {
  const t = await getTranslations();
  const after = parseDiaryCursor(cursor);
  if (!after) throw new Error(t("errors.notAPageOfDiary"));
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) throw new Error(t("errors.signInForDiary"));
  return loadDiaryPage(supabase, userId, after);
}
