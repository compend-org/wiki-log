// ABOUTME: An admin's buttons for closing reports, or reopening them.
// ABOUTME: Runs the given action (for a post, or a whole account), then refreshes the page.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReportStatus } from "@/lib/adminReports";

export default function ReportStatusButtons({
  setStatus,
  status,
}: {
  // A server action with everything but the new status already bound
  setStatus: (next: ReportStatus) => Promise<{ error?: string }>;
  status: ReportStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  async function change(next: ReportStatus) {
    if (busy) return;

    setBusy(true);
    setError("");
    try {
      const result = await setStatus(next);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      // The change may have been saved even though no answer came back
      setError("Couldn't confirm the change. Refresh to check.");
    } finally {
      setBusy(false);
    }
  }

  const button =
    "rounded-lg border border-line px-2.5 py-1 text-sm disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "open" ? (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => change("actioned")}
            className={button}
          >
            Mark actioned
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => change("dismissed")}
            className={button}
          >
            Dismiss
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => change("open")}
          className={button}
        >
          Reopen
        </button>
      )}
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}
