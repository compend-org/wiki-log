// ABOUTME: An admin's button for banning someone, which asks for confirmation first.
// ABOUTME: A ban blocks their email and deletes their account and everything they posted.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { banUser } from "@/app/actions";
import Dialog from "@/components/Dialog";

export default function BanButton({
  userId,
  username,
  redirectTo,
  className = "text-sm text-danger hover:underline",
}: {
  userId: string;
  username: string;
  // Where to go once the ban has removed the page you're on. Without it the
  // page just refreshes.
  redirectTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  async function ban() {
    if (busy) return;

    setBusy(true);
    setError("");
    const result = await banUser(userId);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className={className}
      >
        Ban
      </button>

      {open && (
        <Dialog label="Ban" onClose={() => setOpen(false)}>
          <h2 className="text-base font-semibold">Ban {username}?</h2>
          <p>
            This deletes their account and everything they posted, and stops
            their email from signing up again. It can&apos;t be undone.
          </p>

          {error && <p className="text-danger">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={ban}
              disabled={busy}
              className="rounded-lg bg-danger px-3 py-1.5 text-background disabled:opacity-40"
            >
              {busy ? "Banning…" : "Ban"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-line px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
