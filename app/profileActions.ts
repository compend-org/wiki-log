// ABOUTME: Server action that loads the later pages of a person's lists or reviews on their profile.
// ABOUTME: Checks what the browser sent, then renders the page's cards for the viewer.
"use server";

import type { CardsPage } from "@/components/CardPages";
import {
  loadProfilePage,
  type ProfileKind,
} from "@/components/loadProfilePage";
import { isUuid } from "@/lib/ids";
import { parseKeyset } from "@/lib/paging";
import { parseRatingStep } from "@/lib/ratingHistogram";

export async function loadMoreProfile(
  profileId: string,
  kind: ProfileKind,
  cursor: unknown,
): Promise<CardsPage> {
  const after = parseKeyset(cursor);
  if (
    typeof profileId !== "string" ||
    !isUuid(profileId) ||
    (kind !== "lists" && kind !== "reviews") ||
    !after
  ) {
    throw new Error("That isn't a page of a profile.");
  }
  return loadProfilePage(profileId, kind, after);
}

export async function loadMoreProfileRated(
  profileId: string,
  rating: unknown,
  cursor: unknown,
): Promise<CardsPage> {
  const after = parseKeyset(cursor);
  const step = parseRatingStep(rating);
  if (
    typeof profileId !== "string" ||
    !isUuid(profileId) ||
    step === null ||
    !after
  ) {
    throw new Error("That isn't a page of a profile's rated reviews.");
  }
  return loadProfilePage(profileId, "reviews", after, step);
}
