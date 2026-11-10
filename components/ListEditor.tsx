"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { addToList, createList, stageItem } from "@/app/actions";
import ItemPicker from "@/components/ItemPicker";
import ItemImage from "@/components/icons/ItemImage";
import ListPager from "@/components/ListPager";
import { track } from "@/lib/analytics";
import {
  fetchListPage,
  LIST_PAGE_SIZE,
  pageCount,
  pageOfRank,
} from "@/lib/listPages";
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
}: {
  entry: ListEntry;
  rank: number;
  ranked: boolean;
  selected: boolean;
  onRemove: (itemId: string) => void;
  onMove: (itemId: string) => void;
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
  };
  ownerName: string;
  // A saved list arrives a page at a time; a new one holds all its items here
  initialItems: ListEntry[];
  initialPage?: number;
  initialTotal?: number;
}) {
  const [items, setItems] = useState<ListEntry[]>(initialItems);
  const [page, setPage] = useState<number>(initialPage);
  const [savedTotal, setSavedTotal] = useState<number>(
    initialTotal ?? initialItems.length,
  );
  const [loading, setLoading] = useState<boolean>(false);
  // The item whose "Move to position" box is open, and what's typed in it
  const [moving, setMoving] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>("");
  // Says where an item went when that's on another page
  const [notice, setNotice] = useState<{ text: string; page: number } | null>(
    null,
  );
  // Only the newest page load is shown, if several overlap
  const loadCount = useRef(0);
  const [title, setTitle] = useState<string>(list.title);
  const [description, setDescription] = useState<string>(
    list.description ?? "",
  );
  const [ranked, setRanked] = useState<boolean>(list.ranked);
  const [adding, setAdding] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [detailsMessage, setDetailsMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const router = useRouter();

  const listId = list.id;
  // Saved lists are paged; a new list is all here, on one page
  const total = listId === null ? items.length : savedTotal;
  const offset = listId === null ? 0 : (page - 1) * LIST_PAGE_SIZE;
  const lastPage = listId === null ? 1 : pageCount(total);
  const movingEntry = items.find((i) => i.itemId === moving) ?? null;
  const movingRank = movingEntry ? offset + items.indexOf(movingEntry) + 1 : 0;

  async function loadPage(wanted: number) {
    if (listId === null) return;
    const ticket = ++loadCount.current;
    setLoading(true);
    const result = await fetchListPage(createClient(), listId, wanted);
    if (ticket !== loadCount.current) return;
    if (result.error) {
      setLoading(false);
      setError(result.error);
      return;
    }
    // The list got shorter than this page (say, from another tab): show its end
    const last = pageCount(result.total);
    if (wanted > last) {
      await loadPage(last);
      return;
    }
    setLoading(false);
    setItems(
      result.entries.map((e) => ({
        itemId: e.itemId,
        title: e.title,
        imageUrl: e.imageUrl,
      })),
    );
    setSavedTotal(result.total);
    setPage(wanted);
    if (moving && !result.entries.some((e) => e.itemId === moving)) {
      setMoving(null);
    }
    // Keeps the page in the address, so reloading comes back to it
    const path = window.location.pathname;
    window.history.replaceState(
      null,
      "",
      wanted === 1 ? path : `${path}?page=${wanted}`,
    );
  }

  function goToPage(wanted: number) {
    setError("");
    setNotice(null);
    loadPage(wanted);
  }

  // Mouse drags after a few pixels, touch after a short press (so the page
  // still scrolls), and the keyboard works too
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    // While another page loads, the tiles on screen are about to change
    if (!over || active.id === over.id || loading) return;

    const oldIndex = items.findIndex((i) => i.itemId === active.id);
    const newIndex = items.findIndex((i) => i.itemId === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = items;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    setError("");
    setNotice(null);
    if (listId === null) return;

    // Just the one move, so a long list isn't sent back in full. Positions
    // count from the top of the whole list, not this page.
    const { error } = await createClient().rpc("move_list_item", {
      p_list: listId,
      p_item: String(active.id),
      p_position: offset + newIndex + 1,
    });
    if (error) {
      setItems(previous);
      setError(error.message);
      return;
    }
    track("list_reordered");
  }

  function openMove(itemId: string) {
    setError("");
    setNotice(null);
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
    if (!Number.isInteger(rank) || rank < 1 || rank > total) {
      setError(`Pick a position from 1 to ${total.toLocaleString("en-US")}.`);
      return;
    }
    setError("");
    setMoving(null);
    if (rank === movingRank) return;

    if (listId === null) {
      setItems(arrayMove(items, movingRank - 1, rank - 1));
      return;
    }

    setLoading(true);
    const { error } = await createClient().rpc("move_list_item", {
      p_list: listId,
      p_item: movingEntry.itemId,
      p_position: rank,
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    const target = pageOfRank(rank);
    setNotice(
      target === page
        ? null
        : {
            text: `Moved “${movingEntry.title}” to #${rank.toLocaleString("en-US")}, on page ${target}.`,
            page: target,
          },
    );
    track("list_reordered");
    // Everything between the old and new places shifted by one
    await loadPage(page);
  }

  async function handleAdd(itemId: string) {
    setError("");
    setNotice(null);
    const result =
      listId === null
        ? await stageItem(itemId)
        : await addToList({ listId, itemId });
    if (result.error || !result.item) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    if (list.id !== null) track("list_item_added");
    const added = result.item;
    setAdding(false);
    if (listId === null) {
      setItems((prev) =>
        prev.some((i) => i.itemId === added.itemId) ? prev : [...prev, added],
      );
      return;
    }

    // New items go at the end, which may be on a later page
    const rank = savedTotal + 1;
    setSavedTotal(rank);
    const target = pageOfRank(rank);
    if (target === page) {
      setItems((prev) => [...prev, added]);
    } else {
      setNotice({
        text: `Added “${added.title}” at #${rank.toLocaleString("en-US")}, on page ${target}.`,
        page: target,
      });
    }
  }

  async function handleRemove(itemId: string) {
    const previous = items;
    setItems(items.filter((i) => i.itemId !== itemId));
    if (moving === itemId) setMoving(null);
    setError("");
    setNotice(null);
    if (listId === null) return;

    const { error } = await createClient().rpc("remove_list_item", {
      p_list: listId,
      p_item: itemId,
    });
    if (error) {
      setItems(previous);
      setError(error.message);
      return;
    }
    setSavedTotal((t) => t - 1);
    // The next page's first item moves up onto this one, or, if this page is
    // now empty, the one before is shown
    if (offset + previous.length < savedTotal || previous.length === 1) {
      await loadPage(page);
    }
    track("list_item_removed");
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
      setDetailsMessage(error.message);
      return;
    }
    track("list_edited", { item_count: total, ranked });
    router.push(`/list/${list.id}`);
    router.refresh();
  }

  async function handleDeleteList() {
    if (list.id === null) return;
    if (!window.confirm("Delete this list? This can't be undone.")) return;
    const { error } = await createClient()
      .from("lists")
      .delete()
      .eq("id", list.id);
    if (error) {
      setError(error.message);
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
          <Link href={`/list/${list.id}`} className="text-sm underline">
            View list
          </Link>
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
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={ranked}
            onChange={(e) => setRanked(e.target.checked)}
          />
          Ranked list (items are numbered)
        </label>
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

        {error && <p className="text-sm text-danger">{error}</p>}
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
