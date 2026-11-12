"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import { useDraft } from "@/lib/useDraft";

const MAX = 300;

export default function BioEditor({
  userId,
  savedBio,
}: {
  userId: string;
  savedBio: string;
}) {
  const router = useRouter();
  const [bio, setBio] = useDraft(savedBio);
  const [busy, setBusy] = useState<boolean>(false);
  const [refreshing, startRefresh] = useTransition();
  const [message, setMessage] = useState<string>("");

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Tidy up: trim the ends and allow at most one blank line in a row
    const clean = bio
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    setBusy(true);
    setMessage("");
    const { error } = await createClient()
      .from("profiles")
      .update({ bio: clean === "" ? null : clean })
      .eq("id", userId);
    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }
    track("profile_updated", { field: "bio" });
    setBio(clean);
    setMessage("Saved.");
    // Brings the saved bio back from the server
    startRefresh(() => router.refresh());
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-2">
      <label htmlFor="bio" className="text-sm">
        Bio
      </label>
      <textarea
        id="bio"
        value={bio}
        onChange={(e) => {
          setBio(e.target.value);
          setMessage("");
        }}
        // Saving replaces the text with the tidied one, so typing waits until
        // the saved bio is back
        readOnly={busy || refreshing}
        maxLength={MAX}
        rows={4}
        placeholder="A few words about yourself (optional)"
        className="border border-line bg-surface px-4 py-2 text-foreground"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || refreshing || bio === savedBio}
          className="bg-accent px-4 py-2 text-background disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save bio"}
        </button>
        <span className="text-xs text-muted">
          {bio.length}/{MAX}
        </span>
        {message && <span className="text-sm text-muted">{message}</span>}
      </div>
    </form>
  );
}
