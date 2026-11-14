// ABOUTME: The red cross that deletes a compound you crafted, after asking.
// ABOUTME: Refused by the server once anything else refers to the compound.
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteCompound } from "@/app/actions";
import { useRemoveCard } from "@/components/CardPages";
import ConfirmDialog from "@/components/ConfirmDialog";
import DeleteIcon from "@/components/icons/DeleteIcon";

export default function CompoundDeleteButton({
  id,
  cardKey,
  onDeleted,
  iconClassName = "h-4 w-4",
}: {
  id: string;
  // The key of the card it is on in a CardPages
  cardKey?: string;
  // What to do once it's gone. Goes to the home page when left out.
  onDeleted?: () => void;
  // The size of the cross
  iconClassName?: string;
}) {
  const [open, setOpen] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const router = useRouter();
  const removeCard = useRemoveCard();

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await deleteCompound(id);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    removeCard?.(cardKey ?? id);
    if (onDeleted) onDeleted();
    else router.push("/");
  }

  return (
    <span className="relative z-10 inline-flex items-center">
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        aria-label="Delete this compound"
        title="Delete this compound"
        className="flex text-danger hover:opacity-70"
      >
        <DeleteIcon className={iconClassName} />
      </button>
      {open && (
        <ConfirmDialog
          title="Delete this compound?"
          confirmLabel="Delete"
          busyLabel="Deleting…"
          busy={busy}
          error={error}
          onConfirm={handleDelete}
          onCancel={() => setOpen(false)}
        >
          <p>It&apos;s deleted for good, and this can&apos;t be undone.</p>
        </ConfirmDialog>
      )}
    </span>
  );
}