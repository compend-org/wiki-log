// ABOUTME: Lists the people the signed-in person has blocked, on the settings
// ABOUTME: page, with a button to unblock each one.
"use client";

import Link from "next/link";
import { useState } from "react";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";

export type BlockedPerson = { id: string; username: string };

export default function BlockedPeople({
  viewerId,
  initialPeople,
}: {
  viewerId: string;
  initialPeople: BlockedPerson[];
}) {
  const [people, setPeople] = useState<BlockedPerson[]>(initialPeople);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  async function unblock(person: BlockedPerson) {
    setBusy(true);
    setError("");
    const { error } = await createClient()
      .from("blocks")
      .delete()
      .eq("blocker_id", viewerId)
      .eq("blocked_id", person.id);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    track("user_unblocked");
    setPeople((current) => current.filter((p) => p.id !== person.id));
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
        Blocked people
      </h2>
      {people.length === 0 && (
        <p className="text-sm text-muted">
          You haven&apos;t blocked anyone. You can block someone from their
          profile.
        </p>
      )}
      {people.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-3">
          <Link
            href={`/u/${encodeURIComponent(p.username)}`}
            className="min-w-0 truncate text-sm underline"
          >
            {p.username}
          </Link>
          <button
            type="button"
            onClick={() => unblock(p)}
            disabled={busy}
            className="rounded-lg border border-line px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Unblock
          </button>
        </div>
      ))}
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
