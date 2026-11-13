// ABOUTME: A confirmation popup in the site's style, for deleting things.
// ABOUTME: Shows what will happen, any error, and a red confirm button beside Cancel.
"use client";

import type { ReactNode } from "react";
import Dialog from "@/components/Dialog";

export default function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busyLabel,
  busy = false,
  error = "",
  onConfirm,
  onCancel,
}: {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog label={title} onClose={onCancel}>
      <h2 className="text-base font-semibold">{title}</h2>
      {children && <div>{children}</div>}

      {error && <p className="text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="flex-1 rounded-lg bg-danger px-3 py-1.5 text-background disabled:opacity-40"
        >
          {busy ? busyLabel : confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-line px-3 py-1.5"
        >
          Cancel
        </button>
      </div>
    </Dialog>
  );
}
