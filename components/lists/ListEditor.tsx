"use client";

import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  addToList,
  createList,
  setListItemPicture,
  stageItem,
} from "@/app/actions";
import ItemImage from "@/components/items/ItemImage";
import ItemPicker from "@/components/items/ItemPicker";
import ListPager from "@/components/lists/ListPager";
import PicturePicker from "@/components/logs/PicturePicker";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EditIcon from "@/components/ui/EditIcon";
import { track } from "@/lib/analytics/analytics";
import {
  SAVE_FAILED,
  userFacingErrorMessage,
} from "@/lib/errors/userFacingErrorMessage";
import { submitOnModEnter } from "@/lib/hooks/submitShortcut";
import { useDragSensors } from "@/lib/hooks/useDragSensors";
import { isCompoundId } from "@/lib/ids";
import { type EditorSnapshot, SavedListEditing } from "@/lib/lists/listEditing";
import {
  fetchListPage,
  LIST_PAGE_SIZE,
  pageCount,
} from "@/lib/lists/listPages";
import type { PictureChoice } from "@/lib/pictureChoices";
import { createClient } from "@/lib/supabase/client";

export type ListEntry = {
  itemId: string;
  title: string;
  imageUrl: string | null;
};

function SortableTile({
  entry,
  rank,
  ranked,
  selected,
  onRemove,
  onMove,
  onPicture,
}: {
  entry: ListEntry;
  rank: number;
  ranked: boolean;
  selected: boolean;
  onRemove: (itemId: string) => void;
  onMove: (itemId: string) => void;
  // Opens the picture picker. Compounds have no article to pick from.
  onPicture: (entry: ListEntry) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.itemId });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 20 : undefined,
      }}
      {...attributes}
      {...listeners}
      className="relative flex cursor-grab select-none flex-col gap-1 [-webkit-touch-callout:none] active:cursor-grabbing"
    >
      <div className="relative">
        <ItemImage
          src={entry.imageUrl}
          alt={entry.title}
          className={`aspect-square w-full rounded-lg ${
            selected ? "ring-2 ring-accent" : ""
          }`}
        />
        {ranked && (
          <span className="absolute left-1 top-1 rounded bg-background/80 px-1.5 text-sm font-bold text-accent">
            {rank}
          </span>
        )}
        <button
          type="button"
          onClick={() => onMove(entry.itemId)}
          aria-label={`Move ${entry.title} to another position`}
          title="Move to a position"
          className="absolute bottom-1 right-1 rounded bg-background/80 px-1.5 text-sm"
        >
          ⇅
        </button>
        {!isCompoundId(entry.itemId) && (
          <button
            type="button"
            onClick={() => onPicture(entry)}
            aria-label={`Change the picture for ${entry.title}`}
            title="Change the picture"
            className="absolute bottom-1 left-1 rounded bg-background/80 px-1.5 py-1"
          >
            <EditIcon className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemove(entry.itemId)}
          aria-label={`Remove ${entry.title}`}
          className="absolute right-1 top-1 rounded bg-background/80 px-1.5 text-sm"
        >
          ×
        </button>
      </div>
      <span className="truncate text-xs">{entry.title}</span>
    </li>
  );
}

export default function ListEditor({
  list,
  ownerName,
  initialItems,
  initialPage = 1,
  initialTotal,
}: {
  list: {
    id: string | null;
    title: string;
    description: string | null;
    ranked: boolean;
    // A grouped list shown plain (grouped lists are off) is never ranked
    grouped?: boolean;
  };
  ownerName: string;
  // A saved list arrives a page at a time; a new one holds all its items here
  initialItems: ListEntry[];
  initialPage?: number;
  initialTotal?: number;
}) {
  // A new list's items, all kept here until it is created
  const [draftItems, setDraftItems] = useState<ListEntry[]>(initialItems);
  // A new list's pictures picked from the items' articles, by item
  const [draftPictures, setDraftPictures] = useState<Record<string, string>>(
    {},
  );
  // The item whose picture picker is open
  const [picturing, setPicturing] = useState<ListEntry | null>(null);
  // The item whose "Move to position" box is open, and what's typed in it
  const [moving, setMoving] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>("");
  const [title, setTitle] = useState<string>(list.title);
  const [description, setDescription] = useState<string>(
    list.description ?? "",
  );
  const [ranked, setRanked] = useState<boolean>(list.ranked);
  const [adding, setAdding] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [detailsMessage, setDetailsMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [confirmingDelete, setConfirmingDelete] = useState<boolean>(false);
  const router = useRouter();

  const listId = list.id;

  // A saved list is shown a page at a time. Its changes and page loads go
  // through one queue, which reads the page and count as they are when each
  // one runs, so nothing acts on a page that has since changed.
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const { error } = await createClient().rpc(fn, args);
    return {
      error: error ? userFacingErrorMessage(error, SAVE_FAILED) : undefined,
    };
  };
  const [editing] = useState<SavedListEditing | null>(() =>
    listId === null
      ? null
      : new SavedListEditing(
          {
            fetchPage: (wanted) =>
              fetchListPage(createClient(), listId, wanted),
            move: (itemId, position) =>
              rpc("move_list_item", {
                p_list: listId,
                p_item: itemId,
                p_position: position,
              }),
            remove: (itemId) =>
              rpc("remove_list_item", { p_list: listId, p_item: itemId }),
            add: (itemId) => addToList({ listId, itemId }),
            setPicture: (itemId, imageUrl) =>
              setListItemPicture(listId, itemId, imageUrl),
            // Keeps the page in the address, so reloading comes back to it
            pageShown: (wanted) => {
              const path = window.location.pathname;
              window.history.replaceState(
                null,
                "",
                wanted === 1 ? path : `${path}?page=${wanted}`,
              );
            },
          },
          {
            items: initialItems,
            page: initialPage,
            total: initialTotal ?? initialItems.length,
          },
          (snapshot) => setSaved(snapshot),
        ),
  );
  const [saved, setSaved] = useState<EditorSnapshot | null>(
    () => editing?.snapshot ?? null,
  );

  const items = saved ? saved.items : draftItems;
  const page = saved ? saved.page : 1;
  const total = saved ? saved.total : draftItems.length;
  // True while a saved list's change or page load is queued or running
  const loading = saved?.busy ?? false;
  const notice = saved?.notice ?? null;
  const shownError = error || saved?.error || "";
  const offset = (page - 1) * LIST_PAGE_SIZE;
  const lastPage = pageCount(total);
  const movingEntry = items.find((i) => i.itemId === moving) ?? null;
  const movingRank = movingEntry ? offset + items.indexOf(movingEntry) + 1 : 0;

  function goToPage(wanted: number) {
    setError("");
    editing?.goToPage(wanted);
  }

  const sensors = useDragSensors();

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setError("");

    if (!editing) {
      const from = draftItems.findIndex((i) => i.itemId === active.id);
      const to = draftItems.findIndex((i) => i.itemId === over.id);
      if (from >= 0 && to >= 0) setDraftItems(arrayMove(draftItems, from, to));
      return;
    }
    // Ignored while another change or page load is going on
    if (await editing.drag(String(active.id), String(over.id))) {
      track("list_reordered");
    }
  }

  function openMove(itemId: string) {
    setError("");
    if (moving === itemId) {
      setMoving(null);
      return;
    }
    setMoving(itemId);
    setMoveTarget("");
  }

  // Moves an item to any position in the list, including ones on other pages,
  // which dragging can't reach
  async function moveToPosition() {
    if (!movingEntry) return;
    const rank = Number(moveTarget);
    setError("");
    setMoving(null);

    if (!editing) {
      if (!Number.isInteger(rank) || rank < 1 || rank > total) {
        setError(`Pick a position from 1 to ${total.toLocaleString("en-US")}.`);
        return;
      }
      setDraftItems(arrayMove(draftItems, movingRank - 1, rank - 1));
      return;
    }
    if (await editing.moveTo(movingEntry.itemId, movingEntry.title, rank)) {
      track("list_reordered");
    }
  }

  // Called by the picker once it knows the item, which can be a while after
  // it was chosen. A saved list adds it by the page and count as they are
  // then. If the request fails outright, this rejects, so the picker keeps
  // the choice and says it couldn't reach the server.
  async function handleAdd(itemId: string) {
    setError("");
    if (!editing) {
      const result = await stageItem(itemId);
      if (result.error || !result.item) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      const added = result.item;
      setDraftItems((prev) =>
        prev.some((i) => i.itemId === added.itemId) ? prev : [...prev, added],
      );
      setAdding(false);
      return;
    }
    const { added } = await editing.add(itemId);
    if (added) {
      track("list_item_added");
      setAdding(false);
    }
  }

  async function handleRemove(itemId: string) {
    if (moving === itemId) setMoving(null);
    setError("");
    if (!editing) {
      setDraftItems((prev) => prev.filter((i) => i.itemId !== itemId));
      setDraftPictures(({ [itemId]: _, ...others }) => others);
      return;
    }
    if (await editing.remove(itemId)) track("list_item_removed");
  }

  // A saved list keeps the picked picture at once; a new one, when created
  async function handlePicture(itemId: string, choice: PictureChoice | null) {
    setError("");
    // Null is the item's own picture
    const stored = choice && !choice.isDefault ? choice.url : null;
    const shown = choice?.url ?? null;
    if (!editing) {
      setDraftPictures(({ [itemId]: _, ...others }) =>
        stored ? { ...others, [itemId]: stored } : others,
      );
      setDraftItems((prev) =>
        prev.map((i) => (i.itemId === itemId ? { ...i, imageUrl: shown } : i)),
      );
      return;
    }
    await editing.setPicture(itemId, stored, shown);
  }

  async function saveList() {
    const t = title.trim();
    if (t.length < 1 || t.length > 80) {
      setDetailsMessage("Titles are 1–80 characters.");
      return;
    }
    if (list.id === null) {
      if (items.length === 0) {
        setDetailsMessage("Add at least one item first.");
        return;
      }
      setBusy(true);
      setDetailsMessage("");
      const result = await createList({
        title: t,
        description,
        ranked,
        itemIds: items.map((i) => i.itemId),
        pictures: draftPictures,
      });
      if (result.error || !result.id) {
        setBusy(false);
        setDetailsMessage(result.error ?? "Couldn't create the list.");
        return;
      }
      track("list_created", { item_count: items.length, ranked });
      router.push(`/list/${result.id}`);
      router.refresh();
      return;
    }
    setBusy(true);
    setDetailsMessage("");
    const { error } = await createClient()
      .from("lists")
      .update({ title: t, description: description.trim() || null, ranked })
      .eq("id", list.id);

    if (error) {
      setBusy(false);
      setDetailsMessage(userFacingErrorMessage(error, SAVE_FAILED));
      return;
    }
    track("list_edited", { item_count: total, ranked });
    router.push(`/list/${list.id}`);
    router.refresh();
  }

  async function handleDeleteList() {
    if (list.id === null) return;
    setBusy(true);
    setError("");
    const { error } = await createClient()
      .from("lists")
      .delete()
      .eq("id", list.id);
    if (error) {
      setBusy(false);
      setError(
        userFacingErrorMessage(
          error,
          "Couldn't delete the list. Please try again.",
        ),
      );
      return;
    }
    track("list_deleted");
    router.push(`/u/${encodeURIComponent(ownerName)}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">
          {list.id === null ? "New list" : "Edit list"}
        </h1>
        {list.id !== null && (
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
        )}
      </header>

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
        <label className="flex flex-col gap-1 text-sm">
          Description (optional)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={2}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-foreground"
          />
        </label>
        {!list.grouped && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ranked}
              onChange={(e) => setRanked(e.target.checked)}
            />
            Ranked list (items are numbered)
          </label>
        )}
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Items
          {total > 0 &&
            ` · ${total.toLocaleString("en-US")} · drag or ⇅ to reorder`}
        </h2>

        <ListPager
          page={page}
          last={lastPage}
          onPage={goToPage}
          disabled={loading}
        />

        <DndContext
          id={`list-${list.id ?? "new"}`}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.itemId)}
            strategy={rectSortingStrategy}
          >
            <ul
              aria-busy={loading}
              className={`grid grid-cols-3 gap-3 sm:grid-cols-4 ${
                loading ? "opacity-60" : ""
              }`}
            >
              {items.map((entry, index) => (
                <SortableTile
                  key={entry.itemId}
                  entry={entry}
                  rank={offset + index + 1}
                  ranked={ranked}
                  selected={entry.itemId === moving}
                  onRemove={handleRemove}
                  onMove={openMove}
                  onPicture={setPicturing}
                />
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(!adding);
                    setError("");
                  }}
                  aria-label="Add an item"
                  className={`flex aspect-square w-full items-center justify-center rounded-lg border-2 border-dashed text-5xl transition-colors hover:border-accent hover:text-accent ${
                    adding
                      ? "border-accent text-accent"
                      : "border-line text-muted"
                  }`}
                >
                  +
                </button>
              </li>
            </ul>
          </SortableContext>
        </DndContext>

        <ListPager
          page={page}
          last={lastPage}
          onPage={goToPage}
          disabled={loading}
        />

        {movingEntry && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              moveToPosition();
            }}
            onKeyDown={submitOnModEnter}
            className="card sticky bottom-2 z-30 flex flex-wrap items-center gap-2 p-3 text-sm"
          >
            <label className="flex flex-wrap items-center gap-2">
              <span>
                Move “{movingEntry.title}” (now #
                {movingRank.toLocaleString("en-US")}) to position
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={total}
                value={moveTarget}
                onChange={(e) => setMoveTarget(e.target.value)}
                placeholder={`1–${total}`}
                // biome-ignore lint/a11y/noAutofocus: opened by the user to type a position
                autoFocus
                className="w-24 rounded-lg border border-line bg-surface px-2 py-1 text-foreground"
              />
            </label>
            <button
              type="submit"
              data-submit
              disabled={loading || moveTarget === ""}
              className="rounded-lg bg-accent px-3 py-1 text-background disabled:opacity-40"
            >
              Move
            </button>
            <button
              type="button"
              onClick={() => setMoving(null)}
              className="rounded-lg border border-line px-3 py-1"
            >
              Cancel
            </button>
          </form>
        )}

        {picturing && (
          <PicturePicker
            itemId={picturing.itemId}
            label={`Picture for “${picturing.title}” in this list`}
            picked={picturing.imageUrl}
            onPick={(choice) => handlePicture(picturing.itemId, choice)}
            onClose={() => setPicturing(null)}
          />
        )}

        {notice && (
          <p className="text-sm text-muted">
            {notice.text}{" "}
            <button
              type="button"
              onClick={() => goToPage(notice.page)}
              className="underline"
            >
              Go to page {notice.page}
            </button>
          </p>
        )}

        {adding && (
          <div className="flex flex-col gap-2">
            <ItemPicker onPick={handleAdd} autoFocus />
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="self-start rounded-lg border border-line px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        )}

        {shownError && <p className="text-sm text-danger">{shownError}</p>}
      </section>
      <section className="flex flex-col gap-2">
        <button
          type="button"
          onClick={saveList}
          disabled={busy}
          className="self-start rounded-lg bg-accent px-6 py-2 text-background disabled:opacity-40"
        >
          {list.id === null
            ? busy
              ? "Creating…"
              : "Create list"
            : busy
              ? "Saving…"
              : "Save list"}
        </button>
        {detailsMessage && (
          <p className="text-sm text-danger">{detailsMessage}</p>
        )}
        <p className="text-xs text-muted">
          {list.id === null
            ? "Nobody sees this list until you create it."
            : "Items are saved as you add and move them. This saves the title, description and ranking, then opens the list."}
        </p>
      </section>
      {list.id !== null && (
        <section className="border-t border-line pt-4">
          <button
            type="button"
            onClick={handleDeleteList}
            className="text-sm text-danger underline"
          >
            Delete this list
          </button>
        </section>
      )}
    </div>
  );
}
