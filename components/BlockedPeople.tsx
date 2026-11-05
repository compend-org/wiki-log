// ABOUTME: Lists the people the signed-in person has blocked, on the settings
// ABOUTME: page, with a button to unblock each one.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type BlockedPerson = { id: string; username: string };

type BlockRow = {
  blocked_id: string;
  profiles: { username: string } | null;
};

export default function BlockedPeople() {
  const [viewerId, setViewerId] = useState<string>("");
  const [people, setPeople] = useState<BlockedPerson[]>([]);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data, error } = await supabase
        .from("blocks")
        .select("blocked_id, profiles!blocks_blocked_id_fkey(username)")
        .eq("blocker_id", userData.user.id)
        .order("created_at", { ascending: false });
      if (error) setError(error.message);
      setViewerId(userData.user.id);
      setPeople(
        ((data ?? []) as unknown as BlockRow[]).map((r) => ({
          id: r.blocked_id,
          username: r.profiles?.username ?? "Someone",
        })),
      );
      setLoaded(true);
    }
    load();
  }, []);

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
    setPeople((current) => current.filter((p) => p.id !== person.id));
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
        Blocked people
      </h2>
      {loaded && people.length === 0 && (
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
