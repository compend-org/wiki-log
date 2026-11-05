// ABOUTME: The like state and toggle behind every like button for a review or a list.
// ABOUTME: Buttons for the same thing share what the viewer did, wherever they are mounted.
"use client";

import { useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

const UNIQUE_VIOLATION = "23505";

// What the viewer has done since the app loaded. A page can hold several
// buttons for one thing (feed tabs, narrow and wide layouts, routes kept alive
// across navigation), and their server props may predate these likes.
const viewerLikes = new Map<string, boolean>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function recordViewerLike(key: string, liked: boolean) {
  viewerLikes.set(key, liked);
  for (const listener of listeners) listener();
}

export function useLike({
  viewerId,
  table,
  column,
  targetId,
  initialCount,
  initiallyLiked,
}: {
  viewerId: string | null;
  table: "likes" | "list_likes";
  column: "log_id" | "list_id";
  targetId: string;
  initialCount: number;
  initiallyLiked: boolean;
}) {
  const key = `${viewerId}:${table}:${targetId}`;
  const viewerLike = useSyncExternalStore(
    subscribe,
    () => viewerLikes.get(key),
    () => undefined,
  );
  const [busy, setBusy] = useState<boolean>(false);

  const liked = viewerLike ?? initiallyLiked;
  // The server's count already includes the viewer's like when it says liked
  const count = initialCount + Number(liked) - Number(initiallyLiked);

  async function toggle() {
    if (!viewerId || busy) return;

    setBusy(true);
    const next = !liked;
    // Update the screen immediately, undo if the database refuses
    recordViewerLike(key, next);

    const supabase = createClient();
    const { error } = next
      ? await supabase
          .from(table)
          .insert({ user_id: viewerId, [column]: targetId })
      : await supabase
          .from(table)
          .delete()
          .eq("user_id", viewerId)
          .eq(column, targetId);

    // A duplicate means it is already liked, from another browser tab or
    // device, so showing it as liked is correct and lets the viewer remove it
    if (error && error.code !== UNIQUE_VIOLATION) {
      recordViewerLike(key, !next);
    }
    setBusy(false);
  }

  return { liked, count, toggle };
}
