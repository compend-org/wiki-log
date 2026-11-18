// ABOUTME: Edits a saved review list: its details, and the order and removal of its reviews.
// ABOUTME: Reviews are added from their own pages; order and removals save as they're made.
"use client";

import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ItemImage from "@/components/items/ItemImage";
import ListPager from "@/components/lists/ListPager";
import ReviewTextarea from "@/components/logs/ReviewTextArea";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { track } from "@/lib/analytics/analytics";
import {
  SAVE_FAILED,
  userFacingErrorMessage,
} from "@/lib/errors/userFacingErrorMessage";
import { useDragSensors } from "@/lib/hooks/useDragSensors";
import { createClient } from "@/lib/supabase/client";

export type ReviewListEntry = {
  entryId: string;
  title: string;
  imageUrl: string | null;
  // The review's author; null when the viewer can no longer see the review
  author: string | null;
};

function SortableRow({
  entry,
  rank,
  ranked,
  busy,
  onRemove,
}: {
  entry: ReviewListEntry;
  rank: number;
  ranked: boolean;
  busy: boolean;
  onRemove: (entry: ReviewListEntry) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.entryId });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 20 : undefined,
      }}
      className="relative flex items-center gap-3 border-t border-line bg-background py-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${entry.title} to reorder`}
        className="cursor-grab touch-none select-none px-1 text-muted [-webkit-touch-callout:none] active:cursor-grabbing"
      >
        ⠿
      </button>
      <ItemImage
        src={entry.imageUrl}
        alt={entry.title}
        className="h-12 w-12 shrink-0 rounded-lg"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">
          {ranked && `${rank}. `}
          {entry.title}
        </span>
        <span className="truncate text-sm text-muted">
          {entry.author ?? "Review no longer available"}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onRemove(entry)}
        disabled={busy}
        className="text-sm text-muted underline disabled:opacity-40"
      >
        Remove
      </button>
    </li>
  );
}

export default function ReviewListEditor({
  list,
  ownerName,
  initialEntries,
  page,
  lastPage,
  offset,
}: {
  list: {
    id: string;
    title: string;
    description: string | null;
    ranked: boolean;
  };
  ownerName: string;
  // One page of the list's reviews, in order
  initialEntries: ReviewListEntry[];
  page: number;
  lastPage: number;
  // How many reviews come before this page
  offset: number;
}) {
  const [entries, setEntries] = useState<ReviewListEntry[]>(initialEntries);
  const [title, setTitle] = useState<string>(list.title);
  const [description, setDescription] = useState<string>(
    list.description ?? "",
  );
  const [ranked, setRanked] = useState<boolean>(list.ranked);
  const [busy, setBusy] = useState<boolean>(false);
  const [detailsMessage, setDetailsMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [confirmingDelete, setConfirmingDelete] = useState<boolean>(false);
  const sensors = useDragSensors();
  const router = useRouter();

  // Runs one change to the list's reviews; on failure the page reloads the
  // saved order, so what's shown stays true
  async function change(fn: string, args: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const { error: rpcError } = await createClient().rpc(fn, {
      p_list: list.id,
      ...args,
    });
    setBusy(false);
    if (rpcError) {
      setError(userFacingErrorMessage(rpcError, SAVE_FAILED));
      router.refresh();
      return false;
    }
    return true;
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || busy) return;
    const from = entries.findIndex((e) => e.entryId === active.id);
    const to = entries.findIndex((e) => e.entryId === over.id);
    if (from < 0 || to < 0) return;
    setEntries(arrayMove(entries, from, to));
    const moved = await change("move_list_entry", {
      p_entry: active.id,
      p_position: offset + to + 1,
    });
    if (moved) track("list_reordered");
  }

  async function handleRemove(entry: ReviewListEntry) {
    if (busy) return;
    setEntries(entries.filter((e) => e.entryId !== entry.entryId));
    const removed = await change("remove_list_entry", {
      p_entry: entry.entryId,
    });
    if (removed) {
      track("list_item_removed");
      // Later pages move up to fill the gap
      if (lastPage > page) router.refresh();
    }
  }

  async function saveList() {
    const t = title.trim();
    if (t.length < 1 || t.length > 80) {
      setDetailsMessage("Titles are 1–80 characters.");
      return;
    }
    setBusy(true);
    setDetailsMessage("");
    const { error: updateError } = await createClient()
      .from("lists")
      .update({ title: t, description: description.trim() || null, ranked })
      .eq("id", list.id);
    if (updateError) {
      setBusy(false);
      setDetailsMessage(userFacingErrorMessage(updateError, SAVE_FAILED));
      return;
    }
    track("list_edited", {
      item_count: offset + entries.length,
      ranked,
      of_reviews: true,
    });
    router.push(`/list/${list.id}`);
    router.refresh();
  }

  async function handleDeleteList() {
    setBusy(true);
    setError("");
    const { error: deleteError } = await createClient()
      .from("lists")
      .delete()
      .eq("id", list.id);
    if (deleteError) {
      setBusy(false);
      setError(
        userFacingErrorMessage(
          deleteError,
          "Couldn't delete the list. Please try again.",
        ),
      );
      return;
    }
    track("list_deleted");
    router.push(`/u/${encodeURIComponent(ownerName)}`);
    router.refresh();
  }

  const pageHref = (p: number) =>
    p === 1 ? `/list/${list.id}/edit` : `/list/${list.id}/edit?page=${p}`;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Edit list</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveList();
        }}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-foreground"
          />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="list-description">Description (optional)</label>
          <ReviewTextarea
            id="list-description"
            value={description}
            onChange={setDescription}
            maxLength={500}
            rows={2}
            mentions={false}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-foreground"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={ranked}
            onChange={(e) => setRanked(e.target.checked)}
          />
          Ranked list (reviews are numbered)
        </label>
      </form>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Reviews{entries.length > 1 && " · drag to reorder"}
          </h2>
          <p className="text-sm text-muted">
            Changes to the order save immediately. Add reviews from any review's
            page.
          </p>
        </div>

        <ListPager page={page} last={lastPage} href={pageHref} />

        <DndContext
          id={`review-list-${list.id}`}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={entries.map((e) => e.entryId)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col border-b border-line">
              {entries.map((entry, index) => (
                <SortableRow
                  key={entry.entryId}
                  entry={entry}
                  rank={offset + index + 1}
                  ranked={ranked}
                  busy={busy}
                  onRemove={handleRemove}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        <ListPager page={page} last={lastPage} href={pageHref} />

        {error && <p className="text-sm text-danger">{error}</p>}
      </section>

      <section className="flex flex-col gap-2">
        <button
          type="button"
          onClick={saveList}
          disabled={busy}
          className="self-start rounded-lg bg-accent px-6 py-2 text-background disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save details"}
        </button>
        {detailsMessage && (
          <p className="text-sm text-danger">{detailsMessage}</p>
        )}
        <p className="text-xs text-muted">
          Saves the title, description and ranking, then opens the list.
        </p>
      </section>

      <section className="border-t border-line pt-4">
        <button
          type="button"
          onClick={() => {
            setError("");
            setConfirmingDelete(true);
          }}
          className="text-sm text-danger underline"
        >
          Delete this list
        </button>
        {confirmingDelete && (
          <ConfirmDialog
            title="Delete this list?"
            confirmLabel="Delete"
            busyLabel="Deleting…"
            busy={busy}
            error={error}
            onConfirm={handleDeleteList}
            onCancel={() => setConfirmingDelete(false)}
          >
            <p>This can&apos;t be undone.</p>
          </ConfirmDialog>
        )}
      </section>
    </div>
  );
}
