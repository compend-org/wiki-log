// ABOUTME: Server actions that load the later pages of someone else's diary and likes.
// ABOUTME: Check what the browser sent and who is looking, then render the page's cards for them.
"use server";

import { getTranslations } from "next-intl/server";
import {
  type DiaryCursor,
  loadDiaryPage,
  parseDiaryCursor,
} from "@/components/activity/loadDiaryPage";
import {
  type LikesCursor,
  loadLikesPage,
  parseLikesCursor,
} from "@/components/activity/loadLikesPage";
import type { CardsPage } from "@/components/paging/CardPages";
import { getProfileByName } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";

// Who is being looked at, and who is looking
async function whoseAndWho(username: unknown) {
  const t = await getTranslations();
  if (typeof username !== "string") throw new Error(t("errors.noSuchPerson"));
  const profile = await getProfileByName(username);
  if (!profile) throw new Error(t("errors.noSuchPerson"));
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  return {
    supabase,
    profile,
    view: {
      viewerId: claimsData?.claims?.sub as string | undefined,
      ownerName: profile.username,
    },
  };
}

export async function loadMoreProfileDiary(
  username: string,
  cursor: unknown,
): Promise<CardsPage<DiaryCursor>> {
  const t = await getTranslations();
  const after = parseDiaryCursor(cursor);
  if (!after) throw new Error(t("errors.notAPageOfDiary"));
  const { supabase, profile, view } = await whoseAndWho(username);
  return loadDiaryPage(supabase, profile.id, after, view);
}

export async function loadMoreProfileLikes(
  username: string,
  cursor: unknown,
): Promise<CardsPage<LikesCursor>> {
  const t = await getTranslations();
  const after = parseLikesCursor(cursor);
  if (!after) throw new Error(t("errors.notAPageOfLikes"));
  const { supabase, profile, view } = await whoseAndWho(username);
  return loadLikesPage(supabase, profile.id, after, view);
}
