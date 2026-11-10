// ABOUTME: Server action that loads the later pages of a person's lists or reviews on their profile.
// ABOUTME: Checks what the browser sent, then renders the page's cards for the viewer.
"use server";

import {
  loadProfilePage,
  type ProfileCardsPage,
  type ProfileKind,
} from "@/components/loadProfilePage";
import { isUuid } from "@/lib/ids";
import { parseKeyset } from "@/lib/paging";

export async function loadMoreProfile(
  profileId: string,
  kind: ProfileKind,
  cursor: unknown,
): Promise<ProfileCardsPage> {
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
