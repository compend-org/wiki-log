// ABOUTME: Server action that loads the later pages of what the signed-in person has liked.
// ABOUTME: Checks what the browser sent and who is signed in, then renders the page's cards.
"use server";

import { getTranslations } from "next-intl/server";
import {
  type LikesCursor,
  loadLikesPage,
  parseLikesCursor,
} from "@/components/activity/loadLikesPage";
import type { CardsPage } from "@/components/paging/CardPages";
import { createClient } from "@/lib/supabase/server";

export async function loadMoreLikes(
  cursor: unknown,
): Promise<CardsPage<LikesCursor>> {
  const t = await getTranslations();
  const after = parseLikesCursor(cursor);
  if (!after) throw new Error(t("errors.notAPageOfLikes"));
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) throw new Error(t("errors.signInForLikes"));
  return loadLikesPage(supabase, userId, after);
}
