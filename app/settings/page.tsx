"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cleanName, isValidName, NAME_RULES } from "@/lib/username";
import DeleteAccount from "@/components/DeleteAccount";

export default function SettingsPage() {
  const [loaded, setLoaded] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");
  const [savedUsername, setSavedUsername] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUserId(data.user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", data.user.id)
          .maybeSingle();
        if (profile) {
          setUsername(profile.username);
          setSavedUsername(profile.username);
        }
      }
      setLoaded(true);
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId) return;

    const name = cleanName(username);
    if (!isValidName(name)) {
      setMessage(`Names are ${NAME_RULES}.`);
      return;
    }

    setBusy(true);
    setMessage("");
    const { error } = await createClient()
      .from("profiles")
      .update({ username: name })
      .eq("id", userId);
    setBusy(false);

    if (error) {
      setMessage(
        error.code === "23505" ? "That name is taken." : error.message
      );
      return;
    }
    setUsername(name);
    setSavedUsername(name);
    setMessage("Saved.");
  }

  if (!loaded) return <main className="p-8 text-muted">Loading…</main>;

  if (!userId) {
    return (
      <main className="p-8">
        <Link href="/login" className="underline">
          Sign in to edit your profile
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Profile settings</h1>
      <p className="text-sm text-muted">
        Your name and logs are public. You can also sign in with your name.
      </p>
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-background disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
      {message && <p className="text-sm">{message}</p>}
      {savedUsername && (
        <Link
          href={`/u/${encodeURIComponent(savedUsername)}`}
          className="underline"
        >
          View your public profile
        </Link>
      )}
      {savedUsername && <DeleteAccount username={savedUsername} />}
    </main>
  );
}