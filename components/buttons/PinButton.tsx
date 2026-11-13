"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import { useLocalCopy } from "@/lib/useLocalCopy";
import PinIcon from "../icons/PinIcon";

export default function PinButton({
  userId,
  kind,
  targetId,
  pinned,
}: {
  userId: string;
  kind: "log" | "list";
  targetId: string;
  pinned: boolean;
}) {
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  // Follows the server's value, and flips at once on a click, since cards a
  // CardPages loaded after its first page aren't re-rendered on a refresh
  const [isPinned, setIsPinned] = useLocalCopy(pinned);
  const router = useRouter();

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError("");

    const column = kind === "log" ? "log_id" : "list_id";
    const supabase = createClient();
    const { error } = isPinned
      ? await supabase
          .from("pins")
          .delete()
          .eq("user_id", userId)
          .eq(column, targetId)
      : await supabase
          .from("pins")
          .insert({ user_id: userId, [column]: targetId });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    track(isPinned ? "unpinned" : "pinned", { target: kind });
    setIsPinned(!isPinned);
    router.refresh();
  }

  return (
    <span className="relative z-10 inline-flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-label={isPinned ? "Unpin" : "Pin"}
        title={isPinned ? "Unpin" : "Pin"}
        className="flex text-accent hover:text-foreground disabled:opacity-60"
      >
        <PinIcon className="h-4 w-4" filled={isPinned} />
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
