"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRemoveCard } from "@/components/CardPages";
import ConfirmDialog from "@/components/ConfirmDialog";
import DeleteIcon from "@/components/icons/DeleteIcon";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";

// The red cross that deletes one of your reviews or lists, after asking
export default function DeleteButton({
  kind,
  targetId,
  onDeleted,
}: {
  kind: "log" | "list";
  targetId: string;
  // What to do once it's gone. Refreshes the page when left out. A card in a
  // CardPages is taken off the list either way, as the list doesn't follow
  // the refreshed page.
  onDeleted?: () => void;
}) {
  const [open, setOpen] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const router = useRouter();
  const removeCard = useRemoveCard();
  const noun = kind === "log" ? "entry" : "list";

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    setError("");
    const { data, error } = await createClient()
      .from(kind === "log" ? "logs" : "lists")
      .delete()
      .eq("id", targetId)
      .select("id");
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Row-level security refuses silently when it isn't yours
    if (!data || data.length === 0) {
      setError(`Couldn't delete that ${noun}.`);
      return;
    }
    track(kind === "log" ? "log_deleted" : "list_deleted");
    setOpen(false);
    // Cards are keyed by the id of their review or list
    removeCard?.(targetId);
    if (onDeleted) onDeleted();
    else router.refresh();
  }

  return (
    <span className="relative z-10 inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        aria-label={`Delete this ${noun}`}
        title={`Delete this ${noun}`}
        className="flex text-danger hover:opacity-70"
      >
        <DeleteIcon className="h-4 w-4" />
      </button>

      {open && (
        <ConfirmDialog
          title={`Delete this ${noun}?`}
          confirmLabel="Delete"
          busyLabel="Deleting…"
          busy={busy}
          error={error}
          onConfirm={handleDelete}
          onCancel={() => setOpen(false)}
        >
          <p>
            Its likes and comments are deleted with it, and this can&apos;t be
            undone.
          </p>
        </ConfirmDialog>
      )}
    </span>
  );
}
