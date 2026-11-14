// ABOUTME: Server action that loads the later pages of what the signed-in person has liked.
// ABOUTME: Checks what the browser sent and who is signed in, then renders the page's cards.
"use server";

import type { CardsPage } from "@/components/CardPages";
import {
  type LikesCursor,
  loadLikesPage,
  parseLikesCursor,
} from "@/components/loadLikesPage";
import { createClient } from "@/lib/supabase/server";

export async function loadMoreLikes(
  cursor: unknown,
): Promise<CardsPage<LikesCursor>> {
  const after = parseLikesCursor(cursor);
  if (!after) throw new Error("That isn't a page of likes.");
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) throw new Error("Sign in to see what you liked.");
  return loadLikesPage(supabase, userId, after);
}
