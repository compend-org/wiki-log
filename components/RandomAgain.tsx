"use client";

// ABOUTME: Rolls another random article, shown on an article reached by a roll.
// ABOUTME: Lets people keep rolling without going back to the home page.

import { useRandomItem } from "@/lib/useRandomItem";

export default function RandomAgain() {
  const { goRandom, busy, error } = useRandomItem();

  return (
    <div className="flex flex-col items-end gap-1 text-sm">
      <button
        type="button"
        onClick={goRandom}
        disabled={busy}
        className="text-accent underline hover:no-underline disabled:opacity-60"
      >
        {busy ? "finding one…" : "another random article"}
      </button>
      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}
