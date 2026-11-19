// ABOUTME: Server actions that load the later pages of a person's pins, lists or reviews on their profile.
// ABOUTME: Checks what the browser sent, then renders the page's cards for the viewer.
"use server";

import { getTranslations } from "next-intl/server";
import type { CardsPage } from "@/components/paging/CardPages";
import {
  loadPinnedPage,
  loadProfilePage,
  type PinCursor,
  type ProfileKind,
} from "@/components/profile/loadProfilePage";
import { isUuid } from "@/lib/ids";
import { parseKeyset } from "@/lib/paging";
import { parseRatingStep } from "@/lib/ratingHistogram";

export async function loadMoreProfile(
  profileId: string,
  kind: ProfileKind,
  cursor: unknown,
): Promise<CardsPage> {
  const t = await getTranslations();
  const after = parseKeyset(cursor);
  if (
    typeof profileId !== "string" ||
    !isUuid(profileId) ||
    (kind !== "lists" && kind !== "reviews") ||
    !after
  ) {
    throw new Error(t("errors.notAPageOfProfile"));
  }
  return loadProfilePage(profileId, kind, after);
}

export async function loadMoreProfileRated(
  profileId: string,
  rating: unknown,
  cursor: unknown,
): Promise<CardsPage> {
  const t = await getTranslations();
  const after = parseKeyset(cursor);
  const step = parseRatingStep(rating);
  if (
    typeof profileId !== "string" ||
    !isUuid(profileId) ||
    step === null ||
    !after
  ) {
    throw new Error(t("errors.notAPageOfProfileRated"));
  }
  return loadProfilePage(profileId, "reviews", after, step);
}

// A later page of all of someone's lists or reviews, pinned ones included, for
// the pages that show them all
export async function loadMoreProfileAll(
  profileId: string,
  kind: ProfileKind,
  cursor: unknown,
): Promise<CardsPage> {
  const t = await getTranslations();
  const after = parseKeyset(cursor);
  if (
    typeof profileId !== "string" ||
    !isUuid(profileId) ||
    (kind !== "lists" && kind !== "reviews") ||
    !after
  ) {
    throw new Error(t("errors.notAPageOfProfile"));
  }
  return loadProfilePage(profileId, kind, after, undefined, true);
}

// A later page of someone's pins, after the pin `cursor` points at
export async function loadMorePinned(
  profileId: string,
  cursor: unknown,
): Promise<CardsPage<PinCursor>> {
  const t = await getTranslations();
  const { position, id } = (cursor ?? {}) as Record<string, unknown>;
  if (
    typeof profileId !== "string" ||
    !isUuid(profileId) ||
    typeof position !== "number" ||
    !Number.isInteger(position) ||
    typeof id !== "string" ||
    !isUuid(id)
  ) {
    throw new Error(t("errors.notAPageOfProfilePins"));
  }
  return loadPinnedPage(profileId, { position, id });
}
