// ABOUTME: A moderator's button that opens a confirmation form (reason, days, note) before acting.
// ABOUTME: Runs the given server action with what was filled in, then refreshes or moves to another page.
"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import Dialog from "@/components/Dialog";
import {
  type ModerationInput,
  REPORT_REASONS,
  SUSPENSION_DAYS,
} from "@/lib/moderation";

export default function ModerationButton({
  label,
  title,
  description,
  confirmLabel = label,
  askReason = false,
  askDays = false,
  danger = false,
  redirectTo,
  className = "rounded-lg border border-line px-2.5 py-1 text-sm",
  run,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel?: string;
  askReason?: boolean;
  askDays?: boolean;
  danger?: boolean;
  // Where to go once the action has removed the page you're on. Without it the
  // page just refreshes.
  redirectTo?: string;
  className?: string;
  run: (input: ModerationInput) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const reasonId = useId();
  const daysId = useId();
  const noteId = useId();
  const [open, setOpen] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [days, setDays] = useState<number>(7);
  const [note, setNote] = useState<string>("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");
    try {
      const result = await run({
        reason: askReason ? reason : undefined,
        days: askDays ? days : undefined,
        note,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch {
      // The action may have gone through even though no answer came back
      setError("Couldn't confirm it went through. Refresh to check.");
    } finally {
      setBusy(false);
    }
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
        {label}
      </button>

      {open && (
        <Dialog label={label} onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">{title}</h2>
            <p>{description}</p>

            {askReason && (
              <label htmlFor={reasonId} className="flex flex-col gap-1">
                Reason
                <select
                  id={reasonId}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  className="rounded-lg border border-line bg-surface px-3 py-2"
                >
                  <option value="" disabled>
                    Choose a reason
                  </option>
                  {REPORT_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {askDays && (
              <label htmlFor={daysId} className="flex flex-col gap-1">
                For how long?
                <select
                  id={daysId}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="rounded-lg border border-line bg-surface px-3 py-2"
                >
                  {SUSPENSION_DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d === 1 ? "1 day" : `${d} days`}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label htmlFor={noteId} className="flex flex-col gap-1">
              Note for admins (optional)
              <textarea
                id={noteId}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={1000}
                className="rounded-lg border border-line bg-surface px-3 py-2"
              />
            </label>

            {error && <p className="text-danger">{error}</p>}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className={`rounded-lg px-3 py-1.5 text-background disabled:opacity-40 ${danger ? "bg-danger" : "bg-accent"}`}
              >
                {busy ? "Working…" : confirmLabel}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-line px-3 py-1.5"
              >
                Cancel
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
