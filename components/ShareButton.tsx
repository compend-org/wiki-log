"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ShareIcon from "@/components/ShareIcon";
import { createClient } from "@/lib/supabase/client";
import { useLoginHref } from "@/lib/useLoginHref";

// Shares (reposts) a review or a list to the people who follow you
export default function ShareButton({
  viewerId,
  ownerId,
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
  const [shared, setShared] = useState<boolean>(initiallyShared);
  const [count, setCount] = useState<number>(initialCount);
  const [busy, setBusy] = useState<boolean>(false);
  const router = useRouter();

  const own = viewerId === ownerId;
  const column = kind === "log" ? "log_id" : "list_id";

  async function toggle() {
    if (!viewerId) {
      router.push(loginHref);
      return;
    }
    if (own || busy) return;

    setBusy(true);
    const next = !shared;
    // Update the screen immediately, undo if the database refuses
    setShared(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));

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
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
    } else {
      router.refresh();
    }
    setBusy(false);
  }

  // Nothing to show on your own post until someone shares it
  if (own && count === 0) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={own}
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
  );
}
