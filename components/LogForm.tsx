"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { readLog } from "@/lib/logs";
import { logVideo } from "@/app/actions";
import { useRouter } from "next/navigation";
import RatingInput from "./RatingInput";

export default function LogForm({ id }: { id: string }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [review, setReview] = useState<string>("");
  const [saved, setSaved] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data } = await createClient().auth.getUser();
      if (!data.user) {
        setSignedIn(false);
        return;
      }
      setSignedIn(true);
      const existing = await readLog(id, data.user.id);
      if (existing) {
        setRating(existing.rating);
        setReview(existing.review);
        setSaved(true);
      }
    }
    load();
  }, [id]);

  async function handleSave() {
    setBusy(true);
    setError("");
    const result = await logVideo({ videoId: id, rating, review });
    setBusy(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSaved(true);
      router.refresh();
    }
  }

  if (signedIn === null) {
    return <p className="text-muted">Loading…</p>;
  }

  if (!signedIn) {
    return (
      <Link href="/login" className="underline">
        Sign in to log this video
      </Link>
    );
  }

  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      <RatingInput
        value={rating}
        onChange={(v) => {
          setRating(v);
          setSaved(false);
        }}
      />
      <textarea
        value={review}
        onChange={(e) => {
          setReview(e.target.value);
          setSaved(false);
        }}
        placeholder="Add a review (optional)"
        rows={3}
        className="rounded-lg border border-line px-4 py-2 bg-surface text-foreground"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={rating === 0 || busy}
        className="rounded-lg bg-accent px-4 py-2 text-background disabled:opacity-40"
      >
        {busy
          ? "Saving…"
          : rating === 0
            ? "Pick a rating first"
            : saved
              ? "Logged ✓"
              : "Log it"}
      </button>
      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}