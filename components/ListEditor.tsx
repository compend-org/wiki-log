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
import { useState } from "react";
import { addToList } from "@/app/actions";
import ItemImage from "@/components/ItemImage";
import ItemPicker from "@/components/ItemPicker";
import { createClient } from "@/lib/supabase/client";

export type ListEntry = {
  itemId: string;
  title: string;
  imageUrl: string | null;
};

function SortableTile({
  entry,
  index,
  ranked,
  onRemove,
}: {
  entry: ListEntry;
  index: number;
  ranked: boolean;
  onRemove: (itemId: string) => void;
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
      className="relative flex cursor-grab select-none flex-col gap-1 active:cursor-grabbing"
    >
      <div className="relative">
        <ItemImage
          src={entry.imageUrl}
          alt={entry.title}
          className="aspect-square w-full rounded-lg"
        />
        {ranked && (
          <span className="absolute left-1 top-1 rounded bg-background/80 px-1.5 text-sm font-bold text-accent">
            {index + 1}
          </span>
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
}: {
  list: {
    id: string;
    title: string;
    description: string | null;
    ranked: boolean;
  };
  ownerName: string;
  initialItems: ListEntry[];
}) {
  const [items, setItems] = useState<ListEntry[]>(initialItems);
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
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.itemId === active.id);
    const newIndex = items.findIndex((i) => i.itemId === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = items;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    setError("");

    const { error } = await createClient().rpc("reorder_list_items", {
      p_list: list.id,
      p_items: next.map((i) => i.itemId),
    });
    if (error) {
      setItems(previous);
      setError(error.message);
    }
  }

  async function handleAdd(itemId: string) {
    setError("");
    const result = await addToList({ listId: list.id, itemId });
    if (result.error || !result.item) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    const added = result.item;
    setItems((prev) =>
      prev.some((i) => i.itemId === added.itemId) ? prev : [...prev, added],
    );
    setAdding(false);
  }

  async function handleRemove(itemId: string) {
    const previous = items;
    setItems(items.filter((i) => i.itemId !== itemId));
    setError("");

    const { error } = await createClient().rpc("remove_list_item", {
      p_list: list.id,
      p_item: itemId,
    });
    if (error) {
      setItems(previous);
      setError(error.message);
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
    const { error } = await createClient()
      .from("lists")
      .update({ title: t, description: description.trim() || null, ranked })
      .eq("id", list.id);

    if (error) {
      setBusy(false);
      setDetailsMessage(error.message);
      return;
    }
    router.push(`/list/${list.id}`);
    router.refresh();
  }

  async function handleDeleteList() {
    if (!window.confirm("Delete this list? This can't be undone.")) return;
    const { error } = await createClient()
      .from("lists")
      .delete()
      .eq("id", list.id);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(`/u/${encodeURIComponent(ownerName)}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Edit list</h1>
        <Link href={`/list/${list.id}`} className="text-sm underline">
          View list
        </Link>
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
          Items{items.length > 0 && " · drag to reorder"}
        </h2>

        <DndContext
          id={`list-${list.id}`}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.itemId)}
            strategy={rectSortingStrategy}
          >
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {items.map((entry, index) => (
                <SortableTile
                  key={entry.itemId}
                  entry={entry}
                  index={index}
                  ranked={ranked}
                  onRemove={handleRemove}
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
          {busy ? "Saving…" : "Save list"}
        </button>
        {detailsMessage && (
          <p className="text-sm text-danger">{detailsMessage}</p>
        )}
        <p className="text-xs text-muted">
          Items are saved as you add and move them. This saves the title,
          description and ranking, then opens the list.
        </p>
      </section>
      <section className="border-t border-line pt-4">
        <button
          type="button"
          onClick={handleDeleteList}
          className="text-sm text-danger underline"
        >
          Delete this list
        </button>
      </section>
    </div>
  );
}
