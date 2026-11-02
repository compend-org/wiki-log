"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewListForm() {
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [ranked, setRanked] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const t = title.trim();
    if (t.length < 1 || t.length > 80) {
      setError("Titles are 1–80 characters.");
      return;
    }

    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setBusy(false);
      setError("You need to sign in.");
      return;
    }

    const { data, error } = await supabase
      .from("lists")
      .insert({
        user_id: userData.user.id,
        title: t,
        description: description.trim() || null,
        ranked,
      })
      .select("id")
      .single();
    setBusy(false);

    if (error || !data) {
      setError(error?.message ?? "Couldn't create the list.");
      return;
    }
    router.push(`/list/${data.id}/edit`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          autoFocus
          placeholder="e.g. Fruits, ranked"
          className="rounded-lg border border-line bg-surface px-4 py-2 text-foreground"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Description (optional)
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={3}
          className="rounded-lg border border-line bg-surface px-4 py-2 text-foreground"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={ranked}
          onChange={(e) => setRanked(e.target.checked)}
        />
        Ranked list (items are numbered)
      </label>
      <button
        type="submit"
        disabled={busy}
        className="self-start rounded-lg bg-accent px-4 py-2 text-background disabled:opacity-40"
      >
        {busy ? "Creating…" : "Create list"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}