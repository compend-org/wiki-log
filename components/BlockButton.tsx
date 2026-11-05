// ABOUTME: Blocks or unblocks a person from their profile page.
// ABOUTME: Blocking asks for confirmation first; the blocked person isn't told.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function BlockButton({
  viewerId,
  targetId,
  targetName,
  initiallyBlocked,
}: {
  viewerId: string;
  targetId: string;
  targetName: string;
  initiallyBlocked: boolean;
}) {
  const [blocked, setBlocked] = useState<boolean>(initiallyBlocked);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  async function toggle() {
    if (
      !blocked &&
      !window.confirm(
        `Block ${targetName}? You won't see their posts or comments, and neither of you will be able to follow, like, share or comment on the other's posts. They won't be told.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = blocked
      ? await supabase
          .from("blocks")
          .delete()
          .eq("blocker_id", viewerId)
          .eq("blocked_id", targetId)
      : await supabase
          .from("blocks")
          .insert({ blocker_id: viewerId, blocked_id: targetId });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setBlocked(!blocked);
    router.refresh(); // updates the follow button and follower counts
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="rounded-lg border border-line px-4 py-2 text-muted disabled:opacity-40"
      >
        {blocked ? "Unblock" : "Block"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
