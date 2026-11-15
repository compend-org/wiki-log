// ABOUTME: A profile picture that stays unloaded until an admin chooses to see it.
// ABOUTME: Reported accounts' pictures can be graphic, so opening a report never shows one by surprise.
"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";

export default function RevealAvatar({ path }: { path: string | null }) {
  const [shown, setShown] = useState<boolean>(false);

  if (!path) return <p className="text-sm text-muted">No profile picture</p>;
  if (shown) return <Avatar path={path} size={96} />;

  return (
    <button
      type="button"
      onClick={() => setShown(true)}
      className="self-start rounded-lg border border-line px-2.5 py-1 text-sm"
    >
      Show profile picture
    </button>
  );
}
