"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
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
  const router = useRouter();

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError("");

    const column = kind === "log" ? "log_id" : "list_id";
    const supabase = createClient();
    const { error } = pinned
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
    track(pinned ? "unpinned" : "pinned", { target: kind });
    router.refresh();
  }

  return (
    <span className="relative z-10 inline-flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-label={pinned ? "Unpin" : "Pin"}
        title={pinned ? "Unpin" : "Pin"}
        className="flex text-accent hover:text-foreground disabled:opacity-60"
      >
        <PinIcon className="h-4 w-4" filled={pinned} />
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
