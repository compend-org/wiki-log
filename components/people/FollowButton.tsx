"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "@/lib/analytics/analytics";
import {
  SAVE_FAILED,
  userFacingErrorMessage,
} from "@/lib/errors/userFacingErrorMessage";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import { createClient } from "@/lib/supabase/client";

export default function FollowButton({
  viewerId,
  targetId,
  following,
  followsViewer = false,
  compact = false,
}: {
  viewerId: string;
  targetId: string;
  following: boolean;
  // Whether the target already follows the viewer, so the button can offer to follow back
  followsViewer?: boolean;
  // A smaller button, for tight spots such as a notification card
  compact?: boolean;
}) {
  const [shownFollowing, setShownFollowing] = useLocalCopy(following);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  async function toggle() {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = shownFollowing
      ? await supabase
          .from("follows")
          .delete()
          .eq("follower_id", viewerId)
          .eq("following_id", targetId)
      : await supabase
          .from("follows")
          .insert({ follower_id: viewerId, following_id: targetId });
    setBusy(false);
    if (error) {
      setError(userFacingErrorMessage(error, SAVE_FAILED));
      return;
    }
    if (shownFollowing) track("user_unfollowed");
    else track("user_followed", { follows_you: followsViewer });
    setShownFollowing(!shownFollowing);
    router.refresh(); // updates the follower counts
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`rounded-lg disabled:opacity-40 ${
          compact ? "px-3 py-1.5 text-sm" : "px-4 py-2"
        } ${
          shownFollowing
            ? "border border-line enabled:hover:border-accent"
            : "bg-accent text-background enabled:hover:opacity-80"
        }`}
      >
        {shownFollowing
          ? "Following "
          : followsViewer
            ? "Follow back"
            : "Follow"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
