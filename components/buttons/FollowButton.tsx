"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import { useLocalCopy } from "@/lib/useLocalCopy";

export default function FollowButton({
  viewerId,
  targetId,
  following,
  followsViewer = false,
}: {
  viewerId: string;
  targetId: string;
  following: boolean;
  // Whether the target already follows the viewer, so the button can offer to follow back
  followsViewer?: boolean;
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
      setError(error.message);
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
        className={
          shownFollowing
            ? "rounded-lg border border-line px-4 py-2 disabled:opacity-40"
            : "rounded-lg bg-accent px-4 py-2 text-background disabled:opacity-40"
        }
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
