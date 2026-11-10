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
import { useEffect, useState } from "react";
import { addToList } from "@/app/actions";
import ItemImage from "@/components/icons/ItemImage";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";

// Up to this many items, the new one is dragged into place among them;
// past it, people type the rank instead.
const MAX_DRAG_PLACE_ITEMS = 100;

type ListOption = {
  id: string;
  title: string;
  ranked: boolean;
  count: number;
  has: boolean;
};

type Tile = { itemId: string; title: string; imageUrl: string | null };

// Small ranked lists: every item is shown and the new one is dragged into
// place. Big ones (up to 10,000 items): the rank is typed in instead.
type Placing =
  | { kind: "drag"; list: ListOption; tiles: Tile[] }
  | { kind: "rank"; list: ListOption; rank: string };

type Neighbours = { before: string | null; after: string | null };

// The rank typed so far, if it's a whole number in 1..last
function parseRank(rank: string, last: number): number | null {
  const n = Number(rank);
  return rank.trim() !== "" && Number.isInteger(n) && n >= 1 && n <= last
    ? n
    : null;
}

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
      <div
        className={`relative rounded-lg ${isNew ? "ring-2 ring-accent" : ""}`}
      >
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
  signedIn: initiallySignedIn,
}: {
  itemId: string;
  title: string;
  imageUrl: string | null;
  signedIn: boolean;
}) {
  const [signedIn, setSignedIn] = useState<boolean>(initiallySignedIn);
  const [open, setOpen] = useState<boolean>(false);
  const [lists, setLists] = useState<ListOption[] | null>(null);
  const [placing, setPlacing] = useState<Placing | null>(null);
  const [neighbours, setNeighbours] = useState<Neighbours | null>(null);
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
    }),
  );

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
        .in(
          "list_id",
          rows.map((r) => r.id),
        );
      has = new Set((inRows ?? []).map((r) => r.list_id));
    }

    setLists(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        ranked: r.ranked,
        count: r.list_items?.[0]?.count ?? 0,
        has: has.has(r.id),
      })),
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

  async function add(list: ListOption, position?: number): Promise<boolean> {
    setBusy(true);
    setError("");
    const result = await addToList({ listId: list.id, itemId, position });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return false;
    }
    track("list_item_added");
    setLists(
      (prev) =>
        prev?.map((l) =>
          l.id === list.id ? { ...l, has: true, count: l.count + 1 } : l,
        ) ?? prev,
    );
    // Confirmed here rather than by re-rendering the whole page, which takes
    // several database requests. "In Lists" catches up on the next page load.
    setMessage(`Added to “${list.title}”.`);
    return true;
  }

  async function choose(list: ListOption) {
    setError("");
    setMessage("");
    if (list.has || busy) return;

    // Ranked lists with something in them: let the user pick the place
    if (list.ranked && list.count > MAX_DRAG_PLACE_ITEMS) {
      setPlacing({ kind: "rank", list, rank: String(list.count + 1) });
      return;
    }
    if (list.ranked && list.count > 0) {
      const { data, error } = await createClient()
        .from("list_items")
        .select("item_id, items(title, image_url)")
        .eq("list_id", list.id)
        .order("position")
        .limit(MAX_DRAG_PLACE_ITEMS);
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
      setPlacing({
        kind: "drag",
        list,
        tiles: [...tiles, { itemId, title, imageUrl }],
      });
      return;
    }

    await add(list);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || placing?.kind !== "drag") return;
    const oldIndex = placing.tiles.findIndex((t) => t.itemId === active.id);
    const newIndex = placing.tiles.findIndex((t) => t.itemId === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setPlacing({
      ...placing,
      tiles: arrayMove(placing.tiles, oldIndex, newIndex),
    });
  }

  // The rank the new item would get, or null while the typed rank is invalid
  const newPosition =
    placing?.kind === "drag"
      ? placing.tiles.findIndex((t) => t.itemId === itemId) + 1
      : placing?.kind === "rank"
        ? parseRank(placing.rank, placing.list.count + 1)
        : null;

  // Show what the typed rank sits between, so a big list needn't be loaded
  const rankList = placing?.kind === "rank" ? placing.list : null;
  useEffect(() => {
    setNeighbours(null);
    if (!rankList || newPosition === null) return;
    let current = true;
    const timer = setTimeout(async () => {
      const from = Math.max(newPosition - 2, 0);
      const { data } = await createClient()
        .from("list_items")
        .select("position, items(title)")
        .eq("list_id", rankList.id)
        .order("position")
        .range(from, newPosition - 1);
      if (!current) return;
      const rows = (data ?? []) as unknown as {
        items: { title: string } | null;
      }[];
      const titleAt = (i: number) =>
        i < rows.length ? (rows[i].items?.title ?? "Unknown item") : null;
      setNeighbours(
        newPosition === 1
          ? { before: null, after: titleAt(0) }
          : { before: titleAt(0), after: titleAt(1) },
      );
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [rankList, newPosition]);

  async function confirmPlacement() {
    if (!placing || newPosition === null) return;
    const ok = await add(placing.list, newPosition);
    if (ok) setPlacing(null);
  }

  // Nothing to offer signed-out visitors (the review form already says so)
  if (!signedIn) return null;

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
          {placing?.kind === "rank" ? (
            <>
              <label className="flex flex-wrap items-center gap-2 text-sm">
                <span>
                  Rank for{" "}
                  <span className="font-semibold text-accent">{title}</span> in{" "}
                  <span className="font-semibold">“{placing.list.title}”</span>
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={placing.list.count + 1}
                  step={1}
                  value={placing.rank}
                  onChange={(e) =>
                    setPlacing({ ...placing, rank: e.target.value })
                  }
                  className="w-24 rounded-lg border border-line bg-surface px-3 py-1 text-foreground"
                />
                <span className="text-muted">of {placing.list.count + 1}</span>
              </label>
              <p className="min-h-5 text-sm text-muted">
                {newPosition === null
                  ? `Pick a number from 1 to ${placing.list.count + 1}.`
                  : neighbours &&
                    (neighbours.before && neighbours.after
                      ? `Between “${neighbours.before}” and “${neighbours.after}”.`
                      : neighbours.after
                        ? `Before “${neighbours.after}”.`
                        : neighbours.before
                          ? `After “${neighbours.before}”, at the end.`
                          : null)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmPlacement}
                  disabled={busy || newPosition === null}
                  className="rounded-lg bg-accent px-4 py-2 text-sm text-background disabled:opacity-40"
                >
                  {busy
                    ? "Adding…"
                    : newPosition === null
                      ? "Add"
                      : `Add as #${newPosition}`}
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
          ) : placing ? (
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
                      ? " In this list"
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
