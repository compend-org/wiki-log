// ABOUTME: A button that deletes a draft after asking, since the draft's text goes with it.
// ABOUTME: Used on the line above a form holding a draft and on each card of the drafts page.
"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export default function DeleteDraftButton({
  onDelete,
  className,
  children,
}: {
  // Deletes the draft, or says why it couldn't
  onDelete: () => Promise<{ error?: string }>;
  className: string;
  children: ReactNode;
}) {
  const t = useTranslations();
  const [confirming, setConfirming] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await onDelete();
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setConfirming(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setConfirming(true);
        }}
        aria-label={t("drafts.deleteThis")}
        title={t("drafts.deleteThis")}
        className={className}
      >
        {children}
      </button>
      {confirming && (
        <ConfirmDialog
          title={t("drafts.deleteTitle")}
          confirmLabel={t("common.delete")}
          busyLabel={t("common.deleting")}
          busy={busy}
          error={error}
          onConfirm={handleDelete}
          onCancel={() => setConfirming(false)}
        >
          <p>{t("drafts.cantUndo")}</p>
        </ConfirmDialog>
      )}
    </>
  );
}
