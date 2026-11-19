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
import { useFormatter, useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { addToList, setListItemNote } from "@/app/actions";
import ItemImage from "@/components/items/ItemImage";
import NoteField from "@/components/lists/NoteField";
import { track } from "@/lib/analytics/analytics";
import {
  LOAD_FAILED,
  userFacingErrorMessage,
} from "@/lib/errors/userFacingErrorMessage";
import { submitOnModEnter } from "@/lib/hooks/submitShortcut";
import { UNREACHABLE } from "@/lib/lists/listEditing";
import { cleanListNote, noteProblem } from "@/lib/lists/listNotes";
import {
  appendLists,
  fetchPickerLists,
  type PickerList,
} from "@/lib/lists/listPicker";
import { createClient } from "@/lib/supabase/client";

// Up to this many items, the new one is dragged into place among them;
// past it, people type the rank instead.
const MAX_DRAG_PLACE_ITEMS = 100;

type ListOption = PickerList;

// Past this many lists, the picker offers a search box
const SEARCH_FROM = 10;

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
  signedIn,
  aside,
}: {
  itemId: string;
  title: string;
  imageUrl: string | null;
  signedIn: boolean;
  aside?: ReactNode;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const [open, setOpen] = useState<boolean>(false);
  const [lists, setLists] = useState<ListOption[] | null>(null);
  // How many of the person's lists match the search, loaded or not
  const [listTotal, setListTotal] = useState<number>(0);
  const [search, setSearch] = useState<string>("");
  // The search the shown lists are for. Until a new search comes back, the
  // shown lists still belong to this one, and so does "Show more".
  const [shownSearch, setShownSearch] = useState<string>("");
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  // Only the latest request for lists is shown, as searches can overtake
  const listRequest = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [placing, setPlacing] = useState<Placing | null>(null);
  const [neighbours, setNeighbours] = useState<Neighbours | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  // The list the item was just added to, offered a note for it there
  const [noting, setNoting] = useState<{
    listId: string;
    itemId: string;
  } | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>("");

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // A page of the person's lists matching `query`: the first page replaces
  // what is shown, later ones are added below it
  async function loadListPage(query: string, offset: number) {
    const request = ++listRequest.current;
    const page = await fetchPickerLists(createClient(), itemId, query, offset);
    if (request !== listRequest.current) return;
    setLoadingMore(false);
    if (offset === 0) setShownSearch(query);
    if (page.error) {
      setError(page.error);
      if (offset === 0) setLists([]);
      return;
    }
    if (page.total !== null) setListTotal(page.total);
    setLists((shown) =>
      offset === 0 || !shown ? page.lists : appendLists(shown, page.lists),
    );
  }

  function changeSearch(value: string) {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadListPage(value, 0), 250);
  }

  function showMoreLists() {
    if (!lists) return;
    setLoadingMore(true);
    loadListPage(shownSearch, lists.length);
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    setPlacing(null);
    setNoting(null);
    setMessage("");
    setError("");
    if (next) loadListPage(search, 0);
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
    setMessage(t("lists.picker.added", { title: list.title }));
    // The list holds the stored item, whose ID can differ from this page's
    setNoting({ listId: list.id, itemId: result.item?.itemId ?? itemId });
    setNoteDraft("");
    return true;
  }

  async function saveNote() {
    const note = cleanListNote(noteDraft);
    if (!noting || note === null || noteProblem(noteDraft)) return;
    setBusy(true);
    setError("");
    let result: { error?: string };
    try {
      result = await setListItemNote(noting.listId, noting.itemId, note);
    } catch {
      result = { error: UNREACHABLE };
    } finally {
      setBusy(false);
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    track("list_note_saved", { length: note.length, from: "add_to_list" });
    setNoting(null);
    setMessage(`${message} Note saved.`);
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
        setError(userFacingErrorMessage(error, LOAD_FAILED));
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
        i < rows.length
          ? (rows[i].items?.title ?? t("common.unknownItem"))
          : null;
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
  }, [rankList, newPosition, t]);

  async function confirmPlacement() {
    if (!placing || newPosition === null) return;
    const ok = await add(placing.list, newPosition);
    if (ok) setPlacing(null);
  }

  // Nothing to offer signed-out visitors (the review form already says so),
  // but the aside still has its place
  if (!signedIn) {
    return aside ?? null;
  }

  // Lists not loaded yet, once the shown ones belong to the search typed
  const moreLists =
    lists !== null && search === shownSearch ? listTotal - lists.length : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          className="rounded-lg border border-line px-4 py-2 text-sm hover:border-accent"
        >
          {t("lists.addToList")}
        </button>
        {aside}
      </div>

      {open && (
        <div className="card flex flex-col gap-3 p-3">
          {placing?.kind === "rank" ? (
            <>
              <label className="flex flex-wrap items-center gap-2 text-sm">
                <span>
                  {t.rich("lists.picker.rankFor", {
                    item: (c) => (
                      <span className="font-semibold text-accent">{c}</span>
                    ),
                    list: (c) => <span className="font-semibold">{c}</span>,
                    title,
                    listTitle: placing.list.title,
                  })}
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
                <span className="text-muted">
                  {t("lists.picker.rankOf", { total: placing.list.count + 1 })}
                </span>
              </label>
              <p className="min-h-5 text-sm text-muted">
                {newPosition === null
                  ? t("errors.numberRange", { max: placing.list.count + 1 })
                  : neighbours &&
                    (neighbours.before && neighbours.after
                      ? t("lists.picker.between", {
                          before: neighbours.before,
                          after: neighbours.after,
                        })
                      : neighbours.after
                        ? t("lists.picker.before", { after: neighbours.after })
                        : neighbours.before
                          ? t("lists.picker.afterAtEnd", {
                              before: neighbours.before,
                            })
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
                    ? t("lists.picker.adding")
                    : newPosition === null
                      ? t("common.add")
                      : t("lists.picker.addAsRank", { rank: newPosition ?? 0 })}
                </button>
                <button
                  type="button"
                  onClick={() => setPlacing(null)}
                  className="rounded-lg border border-line px-4 py-2 text-sm"
                >
                  {t("common.back")}
                </button>
              </div>
            </>
          ) : placing ? (
            <>
              <p className="text-sm">
                {t.rich("lists.picker.drag", {
                  item: (c) => (
                    <span className="font-semibold text-accent">{c}</span>
                  ),
                  list: (c) => <span className="font-semibold">{c}</span>,
                  title,
                  listTitle: placing.list.title,
                })}
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
                  {busy
                    ? t("lists.picker.adding")
                    : t("lists.picker.addAsRank", { rank: newPosition ?? 0 })}
                </button>
                <button
                  type="button"
                  onClick={() => setPlacing(null)}
                  className="rounded-lg border border-line px-4 py-2 text-sm"
                >
                  {t("common.back")}
                </button>
              </div>
            </>
          ) : noting ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveNote();
              }}
              onKeyDown={submitOnModEnter}
              className="flex flex-col gap-2 text-sm"
            >
              <p className="text-accent">{message}</p>
              <span>
                <span className="font-semibold">{t("lists.picker.note")}</span>{" "}
                <span className="text-muted">{t("common.optional")}</span>
              </span>
              <NoteField
                label={t("lists.picker.noteOptional")}
                value={noteDraft}
                onChange={setNoteDraft}
                readOnly={busy}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  data-submit
                  disabled={
                    busy ||
                    cleanListNote(noteDraft) === null ||
                    noteProblem(noteDraft) !== null
                  }
                  className="rounded-lg bg-accent px-4 py-2 text-background disabled:opacity-40"
                >
                  {busy ? t("common.saving") : t("lists.picker.saveNote")}
                </button>
                <button
                  type="button"
                  onClick={() => setNoting(null)}
                  disabled={busy}
                  className="rounded-lg border border-line px-4 py-2 disabled:opacity-40"
                >
                  {t("lists.picker.done")}
                </button>
              </div>
            </form>
          ) : (
            <>
              {lists !== null && (search !== "" || listTotal > SEARCH_FROM) && (
                <input
                  type="search"
                  value={search}
                  onChange={(e) => changeSearch(e.target.value)}
                  placeholder={t("lists.picker.findPlaceholder")}
                  aria-label={t("lists.picker.findPlaceholder")}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground"
                />
              )}
              {lists === null && (
                <p className="text-sm text-muted">
                  {t("lists.picker.loadingLists")}
                </p>
              )}
              {lists !== null && lists.length === 0 && (
                <p className="text-sm text-muted">
                  {search.trim()
                    ? t("lists.picker.noMatch", { search: search.trim() })
                    : t("lists.picker.noLists")}
                </p>
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
                      ? ` ${t("lists.picker.inThisList")}`
                      : t("lists.picker.countLine", {
                          ranked: l.ranked ? "yes" : "no",
                          count: l.count,
                        })}
                  </span>
                </button>
              ))}
              {moreLists > 0 && (
                <button
                  type="button"
                  onClick={showMoreLists}
                  disabled={loadingMore}
                  className="self-start text-sm underline disabled:opacity-60"
                >
                  {loadingMore
                    ? t("common.loading")
                    : t("lists.picker.showMore", {
                        remaining: format.number(moreLists),
                      })}
                </button>
              )}
              <Link
                href={`/list/new?add=${encodeURIComponent(itemId)}`}
                className="self-start text-sm underline"
              >
                {t("lists.newList")}
              </Link>
            </>
          )}

          {message && !noting && (
            <p className="text-sm text-accent">{message}</p>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
