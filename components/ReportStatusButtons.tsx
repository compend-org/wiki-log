// ABOUTME: An admin's buttons for closing the reports on a post, or reopening them.
// ABOUTME: Applies to every report on the post, then refreshes the page.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setReportStatus } from "@/app/admin/reports/actions";
import type { PostKind, ReportStatus } from "@/lib/adminReports";

export default function ReportStatusButtons({
  kind,
  postId,
  status,
}: {
  kind: PostKind;
  postId: string;
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
      const result = await setReportStatus(kind, postId, next);
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
