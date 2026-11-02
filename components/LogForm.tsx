"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logItem } from "@/app/actions";
import RatingInput from "@/components/RatingInput";

export default function LogForm({
  id,
  alreadyLogged = false,
}: {
  id: string;
  alreadyLogged?: boolean;
}) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [review, setReview] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setSignedIn(Boolean(data.user)));
  }, []);

  async function handleSave() {
    setBusy(true);
    setError("");
    setDone(false);
    const result = await logItem({ itemId: id, rating, review });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    // Ready for the next entry
    setRating(0);
    setReview("");
    setDone(true);
    router.refresh();
  }

  if (signedIn === null) {
    return <p className="text-muted">Loading…</p>;
  }

  if (!signedIn) {
    return (
      <Link href="/login" className="underline">
        Sign in to review this
      </Link>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <RatingInput
        value={rating}
        onChange={(v) => {
          setRating(v);
          setDone(false);
        }}
      />
      <textarea
        value={review}
        onChange={(e) => {
          setReview(e.target.value);
          setDone(false);
        }}
        placeholder="Add a review (optional)"
        rows={3}
        className="border border-line bg-surface px-4 py-2 text-foreground"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={rating === 0 || busy}
        className="self-start bg-accent px-4 py-2 text-background disabled:opacity-40"
      >
        {busy
          ? "Saving…"
          : rating === 0
          ? "Pick a rating first"
          : alreadyLogged
          ? "Log it again"
          : "Log it"}
      </button>
      {done && <p className="text-sm text-accent">Entry added.</p>}
      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}