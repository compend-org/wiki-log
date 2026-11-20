"use client";

// ABOUTME: Hides and shows items for the signed-in person, and keeps the page in step:
// ABOUTME: cards about an item hidden in this visit go away without the page loading again.

import { useSyncExternalStore } from "react";
import { track } from "@/lib/analytics/analytics";
import {
  SAVE_FAILED,
  userFacingErrorMessage,
} from "@/lib/errors/userFacingErrorMessage";
import { createClient } from "@/lib/supabase/client";

// What the viewer hid or showed again since the app loaded, by viewer and
// item. Pages kept alive across navigation were drawn before these changes.
export type HidingChange = {
  hidden: boolean;
  // The card it was hidden from, which then says so; null for none
  fromCard: string | null;
};

const viewerChanges = new Map<string, HidingChange>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const keyOf = (viewerId: string, itemId: string) => `${viewerId}:${itemId}`;

// The viewer's latest change to whether this item is hidden, if they made one
// since the app loaded
export function useHidingChange(
  viewerId: string,
  itemId: string,
): HidingChange | undefined {
  const key = keyOf(viewerId, itemId);
  return useSyncExternalStore(
    subscribe,
    () => viewerChanges.get(key),
    () => undefined,
  );
}

// Hides or shows an item for `viewerId`. `fromCard` names the card it was
// hidden from. Returns an error message, or "" when it worked.
export async function setItemHidden(
  viewerId: string,
  itemId: string,
  hidden: boolean,
  fromCard: string | null = null,
): Promise<string> {
  const supabase = createClient();
  const { error } = hidden
    ? await supabase
        .from("hidden_items")
        .upsert(
          { user_id: viewerId, item_id: itemId },
          { ignoreDuplicates: true },
        )
    : await supabase
        .from("hidden_items")
        .delete()
        .eq("user_id", viewerId)
        .eq("item_id", itemId);
  if (error) return userFacingErrorMessage(error, SAVE_FAILED);

  track(hidden ? "item_hidden" : "item_unhidden");
  viewerChanges.set(keyOf(viewerId, itemId), { hidden, fromCard });
  for (const listener of listeners) listener();
  return "";
}
