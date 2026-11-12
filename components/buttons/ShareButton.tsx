// ABOUTME: Shares or unshares a review or list with the viewer's followers.
// ABOUTME: Rolls back failed changes and explains when a review is no longer available.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ShareIcon from "@/components/icons/ShareIcon";
import { track } from "@/lib/analytics";
import {
  isLogUnavailable,
  MISSING_LOG_MESSAGE,
  markLogUnavailable,
  useLogUnavailable,
} from "@/lib/logAvailability";
import { isMissingLogError } from "@/lib/missingLogError";
import { createClient } from "@/lib/supabase/client";
import { useLocalCopy } from "@/lib/useLocalCopy";
import { useLoginHref } from "@/lib/useLoginHref";

// Shares (reposts) a review or a list to the people who follow you
export default function ShareButton({
  viewerId,
  kind,
  targetId,
  initialCount,
  initiallyShared,
}: {
  viewerId: string | null;
  ownerId: string;
  kind: "log" | "list";
  targetId: string;
  initialCount: number;
  initiallyShared: boolean;
}) {
  const loginHref = useLoginHref();
  const [shared, setShared] = useLocalCopy(initiallyShared);
  // The server's count already includes the viewer's share when it says shared
  const count = Math.max(
    0,
    initialCount + Number(shared) - Number(initiallyShared),
  );
  const [busy, setBusy] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();
  const logId = kind === "log" ? targetId : null;
  const unavailable = useLogUnavailable(logId);

  const column = kind === "log" ? "log_id" : "list_id";

  async function toggle() {
    if (!viewerId) {
      router.push(loginHref);
      return;
    }
    if (busy || isLogUnavailable(logId)) return;

    setBusy(true);
    setErrorMessage("");
    const next = !shared;
    // Update the screen immediately, undo if the database refuses
    setShared(next);

    const supabase = createClient();
    const { error } = next
      ? await supabase
          .from("shares")
          .insert({ user_id: viewerId, [column]: targetId })
      : await supabase
          .from("shares")
          .delete()
          .eq("user_id", viewerId)
          .eq(column, targetId);

    if (error) {
      setShared(!next);
      if (logId !== null && isMissingLogError(error, "shares")) {
        markLogUnavailable(logId);
        router.refresh();
      } else {
        setErrorMessage("Couldn't update your share. Please try again.");
      }
    } else {
      track(next ? "shared_to_followers" : "unshared", { target: kind });
      router.refresh();
    }
    setBusy(false);
  }

  if (unavailable) {
    return <span role="status">{MISSING_LOG_MESSAGE}</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={shared}
        aria-label={shared ? "Undo share" : "Share to your followers"}
        title={shared ? "Undo share" : "Share to your followers"}
        className={`inline-flex h-5 items-center gap-1 text-sm disabled:cursor-default ${
          shared ? "text-[#00ba7c]" : "text-muted enabled:hover:text-[#00ba7c]"
        }`}
      >
        <ShareIcon className="h-4 w-4" />
        {count > 0 && <span>{count}</span>}
      </button>
      {errorMessage && <span role="status">{errorMessage}</span>}
    </>
  );
}
