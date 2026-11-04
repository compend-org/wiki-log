"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLoginHref } from "@/lib/useLoginHref";

const REASONS = [
  { value: "spam", label: "Spam or advertising" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "hate", label: "Hateful content" },
  { value: "sexual", label: "Sexual or graphic content" },
  { value: "other", label: "Something else" },
] as const;

// Lets a signed-in person flag a review, list or comment for the admins
export default function ReportButton({
  viewerId,
  ownerId,
  kind,
  targetId,
  className = "text-sm text-muted hover:underline",
}: {
  viewerId: string | null;
  ownerId: string;
  kind: "log" | "list" | "comment" | "list_comment";
  targetId: string;
  className?: string;
}) {
  const loginHref = useLoginHref();
  const router = useRouter();
  const reasonId = useId();
  const detailsId = useId();
  const [open, setOpen] = useState<boolean>(false);
  const [reason, setReason] = useState<string>("spam");
  const [details, setDetails] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // You can't report yourself
  if (viewerId && viewerId === ownerId) return null;

  function start() {
    if (!viewerId) {
      router.push(loginHref);
      return;
    }
    setError("");
    setOpen(true);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!viewerId || busy) return;

    setBusy(true);
    setError("");
    const { error } = await createClient()
      .from("reports")
      .insert({
        reporter_id: viewerId,
        target_type: kind,
        target_id: targetId,
        reason,
        details: details.trim() || null,
      });
    setBusy(false);

    // 23505: this person already reported it, which is fine
    if (error && error.code !== "23505") {
      setError("Couldn't send the report. Please try again.");
      return;
    }
    setDone(true);
  }

  return (
    <>
      <button type="button" onClick={start} className={className}>
        {done ? "Reported" : "Report"}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-black/40"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Report"
            className="card fixed left-1/2 top-1/2 z-50 flex w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 p-4 text-sm text-foreground"
          >
            {done ? (
              <>
                <p>Thanks. We&apos;ll take a look.</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="self-start rounded-lg border border-line px-3 py-1.5"
                >
                  Close
                </button>
              </>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-3">
                <h2 className="text-base font-semibold">Report this</h2>

                <label htmlFor={reasonId} className="flex flex-col gap-1">
                  Why are you reporting it?
                  <select
                    id={reasonId}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="rounded-lg border border-line bg-surface px-3 py-2"
                  >
                    {REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label htmlFor={detailsId} className="flex flex-col gap-1">
                  Anything else we should know? (optional)
                  <textarea
                    id={detailsId}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="rounded-lg border border-line bg-surface px-3 py-2"
                  />
                </label>

                {error && <p className="text-danger">{error}</p>}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-lg bg-accent px-3 py-1.5 text-background disabled:opacity-40"
                  >
                    {busy ? "Sending…" : "Send report"}
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
            )}
          </div>
        </>
      )}
    </>
  );
}