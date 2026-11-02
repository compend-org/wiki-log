"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { addToList } from "@/app/actions";
import ItemImage from "@/components/ItemImage";

type ListOption = {
  id: string;
  title: string;
  ranked: boolean;
  count: number;
  has: boolean;
};

type Tile = { itemId: string; title: string; imageUrl: string | null };

function PlaceTile({
  tile,
  index,
  isNew,
}: {
  tile: Tile;
  index: number;
  isNew: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tile.itemId });

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
      className="flex cursor-grab select-none flex-col gap-1 active:cursor-grabbing"
    >
      <div className={`relative rounded-lg ${isNew ? "ring-2 ring-accent" : ""}`}>
        <ItemImage
          src={tile.imageUrl}
          alt={tile.title}
          className="aspect-square w-full rounded-lg"
        />
        <span className="absolute left-1 top-1 rounded bg-background/80 px-1.5 text-sm font-bold text-accent">
          {index + 1}
        </span>
      </div>
      <span
        className={`truncate text-xs ${isNew ? "font-semibold text-accent" : ""}`}
      >
        {tile.title}
      </span>
    </li>
  );
}

export default function AddToList({
  itemId,
  title,
  imageUrl,
}: {
  itemId: string;
  title: string;
  imageUrl: string | null;
}) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [open, setOpen] = useState<boolean>(false);
  const [lists, setLists] = useState<ListOption[] | null>(null);
  const [placing, setPlacing] = useState<{
    list: ListOption;
    tiles: Tile[];
  } | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setSignedIn(Boolean(data.user)));
  }, []);

  async function loadLists() {
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSignedIn(false);
      return;
    }

    const { data } = await supabase
      .from("lists")
      .select("id, title, ranked, list_items(count)")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as {
      id: string;
      title: string;
      ranked: boolean;
      list_items: { count: number }[];
    }[];

    let has = new Set<string>();
    if (rows.length > 0) {
      const { data: inRows } = await supabase
        .from("list_items")
        .select("list_id")
        .eq("item_id", itemId)
        .in("list_id", rows.map((r) => r.id));
      has = new Set((inRows ?? []).map((r) => r.list_id));
    }

    setLists(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        ranked: r.ranked,
        count: r.list_items?.[0]?.count ?? 0,
        has: has.has(r.id),
      }))
    );
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    setPlacing(null);
    setMessage("");
    setError("");
    if (next) loadLists();
  }

  async function add(list: ListOption, order?: string[]): Promise<boolean> {
    setBusy(true);
    setError("");
    const result = await addToList({ listId: list.id, itemId, order });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return false;
    }
    setLists(
      (prev) =>
        prev?.map((l) =>
          l.id === list.id ? { ...l, has: true, count: l.count + 1 } : l
        ) ?? prev
    );
    setMessage(`Added to “${list.title}”.`);
    return true;
  }

  async function choose(list: ListOption) {
    setError("");
    setMessage("");
    if (list.has || busy) return;

    // Ranked lists with something in them: let the user pick the place
    if (list.ranked && list.count > 0) {
      const { data, error } = await createClient()
        .from("list_items")
        .select("item_id, items(title, image_url)")
        .eq("list_id", list.id)
        .order("position");
      if (error) {
        setError(error.message);
        return;
      }
      const tiles: Tile[] = (
        (data ?? []) as unknown as {
          item_id: string;
          items: { title: string; image_url: string | null } | null;
        }[]
      ).map((e) => ({
        itemId: e.item_id,
        title: e.items?.title ?? "Unknown item",
        imageUrl: e.items?.image_url ?? null,
      }));
      setPlacing({ list, tiles: [...tiles, { itemId, title, imageUrl }] });
      return;
    }

    await add(list);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !placing) return;
    const oldIndex = placing.tiles.findIndex((t) => t.itemId === active.id);
    const newIndex = placing.tiles.findIndex((t) => t.itemId === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setPlacing({
      ...placing,
      tiles: arrayMove(placing.tiles, oldIndex, newIndex),
    });
  }

  async function confirmPlacement() {
    if (!placing) return;
    const ok = await add(
      placing.list,
      placing.tiles.map((t) => t.itemId)
    );
    if (ok) setPlacing(null);
  }

  // Nothing to offer signed-out visitors (the review form already says so)
  if (!signedIn) return null;

  const newPosition = placing
    ? placing.tiles.findIndex((t) => t.itemId === itemId) + 1
    : 0;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        className="self-start rounded-lg border border-line px-4 py-2 text-sm hover:border-accent"
      >
        Add to list
      </button>

      {open && (
        <div className="card flex flex-col gap-3 p-3">
          {placing ? (
            <>
              <p className="text-sm">
                Drag <span className="font-semibold text-accent">{title}</span>{" "}
                to its place in{" "}
                <span className="font-semibold">“{placing.list.title}”</span>.
              </p>
              <DndContext
                id={`place-${placing.list.id}`}
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={placing.tiles.map((t) => t.itemId)}
                  strategy={rectSortingStrategy}
                >
                  <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {placing.tiles.map((tile, index) => (
                      <PlaceTile
                        key={tile.itemId}
                        tile={tile}
                        index={index}
                        isNew={tile.itemId === itemId}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmPlacement}
                  disabled={busy}
                  className="rounded-lg bg-accent px-4 py-2 text-sm text-background disabled:opacity-40"
                >
                  {busy ? "Adding…" : `Add as #${newPosition}`}
                </button>
                <button
                  type="button"
                  onClick={() => setPlacing(null)}
                  className="rounded-lg border border-line px-4 py-2 text-sm"
                >
                  Back
                </button>
              </div>
            </>
          ) : (
            <>
              {lists === null && (
                <p className="text-sm text-muted">Loading your lists…</p>
              )}
              {lists !== null && lists.length === 0 && (
                <p className="text-sm text-muted">You have no lists yet.</p>
              )}
              {lists?.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => choose(l)}
                  disabled={l.has || busy}
                  className="flex items-baseline justify-between gap-3 rounded-lg border border-line px-3 py-2 text-left hover:border-accent disabled:opacity-60 disabled:hover:border-line"
                >
                  <span className="font-semibold">{l.title}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {l.has
                      ? "✓ In this list"
                      : `${l.ranked ? "Ranked · " : ""}${l.count} ${
                          l.count === 1 ? "item" : "items"
                        }`}
                  </span>
                </button>
              ))}
              <Link href="/list/new" className="self-start text-sm underline">
                New list
              </Link>
            </>
          )}

          {message && <p className="text-sm text-accent">{message}</p>}
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}