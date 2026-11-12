// ABOUTME: Lets the signed-in person change their username, on the settings page.
// ABOUTME: Redraws the page afterwards so everything showing the name picks it up.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import { cleanName, isValidName, NAME_RULES } from "@/lib/username";

export default function UsernameEditor({
  userId,
  initialUsername,
}: {
  userId: string;
  initialUsername: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState<string>(initialUsername);
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const name = cleanName(username);
    if (!isValidName(name)) {
      setMessage(`Usernames are ${NAME_RULES}.`);
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
        error.code === "23505" ? "That username is taken." : error.message,
      );
      return;
    }
    track("profile_updated", { field: "username" });
    setUsername(name);
    setMessage("Saved.");
    // Redraws the top bar, the profile link and account deletion with the new
    // username
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border border-line bg-surface px-4 py-2 text-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="bg-accent px-4 py-2 text-background disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save username"}
        </button>
      </form>
      {message && <p className="text-sm">{message}</p>}
    </>
  );
}
