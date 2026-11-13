"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRemoveCard } from "@/components/CardPages";
import ConfirmDialog from "@/components/ConfirmDialog";
import DeleteIcon from "@/components/icons/DeleteIcon";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";

type Kind = "log" | "list" | "comment" | "list_comment";

// What each kind is stored in, what it is called, and what goes with it
const KINDS: Record<
  Kind,
  { table: string; noun: string; consequence: string }
> = {
  log: {
    table: "logs",
    noun: "entry",
    consequence: "Its likes and comments are deleted with it",
  },
  list: {
    table: "lists",
    noun: "list",
    consequence: "Its likes and comments are deleted with it",
  },
  comment: {
    table: "comments",
    noun: "reply",
    consequence: "Its likes and the replies to it are deleted with it",
  },
  list_comment: {
    table: "list_comments",
    noun: "reply",
    consequence: "Its likes and the replies to it are deleted with it",
  },
};

// The red cross that deletes one of your reviews, lists or replies, after asking
export default function DeleteButton({
  kind,
  targetId,
  cardKey,
  onDeleted,
}: {
  kind: Kind;
  targetId: string;
  // The key of the card it is on in a CardPages, when that isn't targetId
  cardKey?: string;
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
  const { table, noun, consequence } = KINDS[kind];

  async function handleDelete() {
    if (busy) return;
    setBusy(true);
    setError("");
    const { data, error } = await createClient()
      .from(table)
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
    if (kind === "log") track("log_deleted");
    else if (kind === "list") track("list_deleted");
    else
      track("comment_deleted", { target: kind === "comment" ? "log" : "list" });
    setOpen(false);
    // Cards are keyed by the id of their review or list, unless they say so
    removeCard?.(cardKey ?? targetId);
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
          <p>{consequence}, and this can&apos;t be undone.</p>
        </ConfirmDialog>
      )}
    </span>
  );
}