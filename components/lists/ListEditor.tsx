// ABOUTME: Creates a list, or edits a saved one: its details, items, order, pictures and notes.
// ABOUTME: A saved list's item changes save as they're made; its details save with the button.
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
import { useTranslations } from "next-intl";
import { Fragment, useEffect, useState } from "react";
import {
  addToList,
  createList,
  setListItemNote,
  setListItemPicture,
  stageItem,
} from "@/app/actions";
import ItemImage from "@/components/items/ItemImage";
import ItemPicker from "@/components/items/ItemPicker";
import ListPager from "@/components/lists/ListPager";
import NoteBox, { WIDE_COLUMNS } from "@/components/lists/NoteBox";
import NoteButton from "@/components/lists/NoteButton";
import UnsavedNoteDialog from "@/components/lists/UnsavedNoteDialog";
import PicturePicker from "@/components/logs/PicturePicker";
import ReviewTextarea from "@/components/logs/ReviewTextArea";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PictureIcon from "@/components/ui/PictureIcon";
import { track } from "@/lib/analytics/analytics";
import {
  SAVE_FAILED,
  userFacingErrorMessage,
} from "@/lib/errors/userFacingErrorMessage";
import { submitOnModEnter } from "@/lib/hooks/submitShortcut";
import { useDragSensors } from "@/lib/hooks/useDragSensors";
import { isCompoundId } from "@/lib/ids";
import { type EditorSnapshot, SavedListEditing } from "@/lib/lists/listEditing";
import { cleanListNote, noteProblem } from "@/lib/lists/listNotes";
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
  // Why the owner put the item on the list, if they said
  note: string | null;
};

// What to do once a note with unsaved changes is saved or its changes are
// thrown away
type NextStep =
  | { kind: "save" }
  | { kind: "note"; itemId: string }
  | { kind: "move"; itemId: string }
  | { kind: "picture"; itemId: string }
  | { kind: "page"; page: number }
  | { kind: "close" };

// How long "✓ Saved" shows beside an item after its note is saved
const SAVED_SHOWN_MS = 2000;

function SortableTile({
  entry,
  rank,
  ranked,
  selected,
  noting,
  saved,
  onRemove,
  onMove,
  onPicture,
  onNote,
}: {
  entry: ListEntry;
  rank: number;
  ranked: boolean;
  selected: boolean;
  // Whether this item's note is open
  noting: boolean;
  // Whether its note was just saved
  saved: boolean;
  onRemove: (entry: ListEntry) => void;
  onMove: (itemId: string) => void;
  // Opens the picture picker. Compounds have no article to pick from.
  onPicture: (entry: ListEntry) => void;
  onNote: (entry: ListEntry) => void;
}) {
  const t = useTranslations();
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
            selected || noting ? "ring-2 ring-accent" : ""
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
          aria-label={t("lists.editor.moveTo", { title: entry.title })}
          title={t("lists.editor.moveToTitle")}
          className="absolute bottom-1 right-1 rounded bg-background/80 px-1.5 text-sm"
        >
          ⇅
        </button>
        {!isCompoundId(entry.itemId) && (
          <button
            type="button"
            onClick={() => onPicture(entry)}
            aria-label={t("lists.editor.changePictureFor", {
              title: entry.title,
            })}
            title={t("common.changePicture")}
            className="absolute bottom-1 left-1 rounded bg-background/80 px-1.5 py-1"
          >
            <PictureIcon className="h-3 w-3" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemove(entry)}
          aria-label={t("lists.editor.removeItem", { title: entry.title })}
          className="absolute right-1 top-1 rounded bg-background/80 px-1.5 text-sm"
        >
          ×
        </button>
      </div>
      <span className="flex min-w-0 items-baseline gap-1.5 text-xs">
        <span className="truncate">{entry.title}</span>
        {saved && (
          <span role="status" className="shrink-0 text-muted">
            {t("lists.editor.saved")}
          </span>
        )}
      </span>
      <NoteButton entry={entry} editing={noting} onNote={() => onNote(entry)} />
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
  const t = useTranslations();
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
  // The item whose note is open, and what's typed in it
  const [noting, setNoting] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>("");
  const [noteBusy, setNoteBusy] = useState<boolean>(false);
  const [noteError, setNoteError] = useState<string>("");
  // The item whose note was just saved, for a moment
  const [justSaved, setJustSaved] = useState<string | null>(null);
  // What was asked for while the open note had unsaved changes, waiting on
  // what to do with them; then, once they're dealt with, what to do next
  const [pending, setPending] = useState<NextStep | null>(null);
  const [queued, setQueued] = useState<NextStep | null>(null);
  // An item with a note that is about to be removed, waiting on a yes
  const [confirmingRemove, setConfirmingRemove] = useState<ListEntry | null>(
    null,
  );
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
            add: async (itemId) => {
              const result = await addToList({ listId, itemId });
              return result.item
                ? { item: { ...result.item, note: null } }
                : { error: result.error };
            },
            setPicture: (itemId, imageUrl) =>
              setListItemPicture(listId, itemId, imageUrl),
            setNote: (itemId, note) => setListItemNote(listId, itemId, note),
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
  const notingIndex = items.findIndex((i) => i.itemId === noting);
  const notingEntry = notingIndex >= 0 ? items[notingIndex] : null;
  // The last tile in the wide grid's row holding the open note's item, which
  // the note box opens after
  const noteRowEnd =
    notingIndex < 0
      ? -1
      : Math.min(
          items.length - 1,
          Math.floor(notingIndex / WIDE_COLUMNS) * WIDE_COLUMNS +
            WIDE_COLUMNS -
            1,
        );
  const noteDirty =
    notingEntry !== null && cleanListNote(noteDraft) !== notingEntry.note;
  // Why the open note's changes can't be saved, if they can't
  const noteSaveProblem =
    noteProblem(noteDraft) ??
    (cleanListNote(noteDraft) === null
      ? "The note is empty. Keep editing to remove it with Remove note."
      : null);

  // A note with unsaved changes isn't lost by leaving the page
  useEffect(() => {
    if (!noteDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [noteDirty]);

  // Runs what was asked for once the note it waited on is dealt with, with
  // this render's state, which includes the note just saved
  useEffect(() => {
    if (!queued) return;
    setQueued(null);
    perform(queued);
  });

  // Does `step`, first asking what to do with the open note if it has
  // unsaved changes. Only one box is open at a time, so any open note closes.
  // Nothing else starts while a note is saving, so its answer can't land on
  // another item's note.
  function guard(step: NextStep) {
    if (noteBusy) return;
    if (noteDirty) {
      setPending(step);
      return;
    }
    if (noting !== null) closeNote(step.kind === "close");
    perform(step);
  }

  function perform(step: NextStep) {
    switch (step.kind) {
      case "save":
        saveList();
        return;
      case "note":
        openNote(step.itemId);
        return;
      case "move":
        openMove(step.itemId);
        return;
      case "picture":
        setPicturing(items.find((i) => i.itemId === step.itemId) ?? null);
        return;
      case "page":
        setError("");
        editing?.goToPage(step.page);
        return;
      case "close":
        return;
    }
  }

  function goToPage(wanted: number) {
    guard({ kind: "page", page: wanted });
  }

  function openNote(itemId: string) {
    const entry = items.find((i) => i.itemId === itemId);
    if (!entry) return;
    setMoving(null);
    setNoting(itemId);
    setNoteDraft(entry.note ?? "");
    setNoteError("");
  }

  // Closes the open note. Unless something else opens next and takes focus,
  // focus goes back to the note's button.
  function closeNote(restoreFocus = true) {
    const itemId = noting;
    setNoting(null);
    setNoteError("");
    if (itemId === null || !restoreFocus) return;
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(
          `[data-note-button="${window.CSS.escape(itemId)}"]`,
        )
        ?.focus(),
    );
  }

  function toggleNote(entry: ListEntry) {
    guard(
      noting === entry.itemId
        ? { kind: "close" }
        : { kind: "note", itemId: entry.itemId },
    );
  }

  // Saves an item's note, or removes it with null. A saved list keeps it at
  // once; a new one, when it's created.
  async function storeNote(
    itemId: string,
    note: string | null,
    restoreFocus = true,
  ): Promise<boolean> {
    setNoteError("");
    if (editing) {
      setNoteBusy(true);
      const saved = await editing.setNote(itemId, note);
      setNoteBusy(false);
      if (!saved) {
        setNoteError(editing.snapshot.error || SAVE_FAILED);
        return false;
      }
    } else {
      setDraftItems((prev) =>
        prev.map((i) => (i.itemId === itemId ? { ...i, note } : i)),
      );
    }
    if (note === null) track("list_note_removed");
    else track("list_note_saved", { length: note.length, from: "editor" });
    closeNote(restoreFocus);
    setJustSaved(itemId);
    setTimeout(
      () => setJustSaved((shown) => (shown === itemId ? null : shown)),
      SAVED_SHOWN_MS,
    );
    return true;
  }

  async function saveNote(restoreFocus = true): Promise<boolean> {
    if (!notingEntry || noteSaveProblem) return false;
    return storeNote(
      notingEntry.itemId,
      cleanListNote(noteDraft),
      restoreFocus,
    );
  }

  // The unsaved-note question's answers
  async function saveNoteAndContinue() {
    if (await saveNote(pending?.kind === "close")) {
      setQueued(pending);
      setPending(null);
    }
  }

  function discardNoteAndContinue() {
    closeNote(pending?.kind === "close");
    setQueued(pending);
    setPending(null);
  }

  function keepEditingNote() {
    setPending(null);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLTextAreaElement>("[data-note-box] textarea")
        ?.focus(),
    );
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
        setError(
          t("errors.positionRange", { max: total.toLocaleString("en-US") }),
        );
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
        setError(result.error ?? t("common.somethingWentWrong"));
        return;
      }
      const added = { ...result.item, note: null };
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

  // Removing an item with a note deletes the note too, so that asks first
  function askToRemove(entry: ListEntry) {
    if (entry.note) setConfirmingRemove(entry);
    else handleRemove(entry.itemId);
  }

  async function handleRemove(itemId: string) {
    if (moving === itemId) setMoving(null);
    if (noting === itemId) setNoting(null);
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
    const trimmed = title.trim();
    if (trimmed.length < 1 || trimmed.length > 80) {
      setDetailsMessage(t("errors.titleLength"));
      return;
    }
    if (list.id === null) {
      if (items.length === 0) {
        setDetailsMessage(t("errors.addAtLeastOneFirst"));
        return;
      }
      setBusy(true);
      setDetailsMessage("");
      const result = await createList({
        title: trimmed,
        description,
        ranked,
        itemIds: items.map((i) => i.itemId),
        pictures: draftPictures,
        notes: Object.fromEntries(
          items.flatMap((i) => (i.note ? [[i.itemId, i.note]] : [])),
        ),
      });
      if (result.error || !result.id) {
        setBusy(false);
        setDetailsMessage(result.error ?? t("errors.listCreateFailed"));
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
      .update({
        title: trimmed,
        description: description.trim() || null,
        ranked,
      })
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
      setError(userFacingErrorMessage(error, t("errors.listDeleteFailed")));
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
          {list.id === null ? t("lists.newList") : t("lists.editList")}
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
              {t("lists.editor.deleteList")}
            </button>
            {confirmingDelete && (
              <ConfirmDialog
                title={t("lists.editor.deleteTitle")}
                confirmLabel={t("common.delete")}
                busyLabel={t("common.deleting")}
                busy={busy}
                error={error}
                onConfirm={handleDeleteList}
                onCancel={() => setConfirmingDelete(false)}
              >
                <p>{t("lists.editor.cantUndo")}</p>
              </ConfirmDialog>
            )}
          </section>
        )}
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          guard({ kind: "save" });
        }}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          {t("lists.editor.titleLabel")}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-foreground"
          />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="list-description">
            {t("lists.editor.descriptionLabel")}
          </label>
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
        {!list.grouped && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ranked}
              onChange={(e) => setRanked(e.target.checked)}
            />
            {t("lists.editor.rankedLabel")}
          </label>
        )}
      </form>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("lists.editor.items")}
            {total > 0 &&
              t("lists.editor.itemsMeta", {
                total: total.toLocaleString("en-US"),
              })}
          </h2>
          {total > 0 && (
            <p className="text-sm text-muted">
              {list.id !== null && `${t("lists.editor.autosaves")} `}
              {t("lists.editor.notesHelp")}
            </p>
          )}
        </div>

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
                <Fragment key={entry.itemId}>
                  <SortableTile
                    entry={entry}
                    rank={offset + index + 1}
                    ranked={ranked}
                    selected={entry.itemId === moving}
                    noting={entry.itemId === noting}
                    saved={entry.itemId === justSaved}
                    onRemove={askToRemove}
                    onMove={(itemId) => guard({ kind: "move", itemId })}
                    onPicture={(picked) =>
                      guard({ kind: "picture", itemId: picked.itemId })
                    }
                    onNote={toggleNote}
                  />
                  {notingEntry && index === noteRowEnd && (
                    <NoteBox
                      // A new box for each item, so its text box takes focus
                      key={notingEntry.itemId}
                      title={notingEntry.title}
                      rank={ranked ? offset + notingIndex + 1 : null}
                      imageUrl={notingEntry.imageUrl}
                      column={notingIndex % WIDE_COLUMNS}
                      draft={noteDraft}
                      onDraft={setNoteDraft}
                      hasNote={notingEntry.note !== null}
                      busy={noteBusy || loading}
                      error={noteError}
                      onSave={saveNote}
                      onRemove={() => storeNote(notingEntry.itemId, null)}
                      onCancel={() => closeNote()}
                      onDismiss={() => guard({ kind: "close" })}
                    />
                  )}
                </Fragment>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(!adding);
                    setError("");
                  }}
                  aria-label={t("lists.editor.addItem")}
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
                {t("lists.editor.moveSentence", {
                  title: movingEntry.title,
                  rank: movingRank.toLocaleString("en-US"),
                })}
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
              {t("lists.editor.move")}
            </button>
            <button
              type="button"
              onClick={() => setMoving(null)}
              className="rounded-lg border border-line px-3 py-1"
            >
              {t("common.cancel")}
            </button>
          </form>
        )}

        {picturing && (
          <PicturePicker
            itemId={picturing.itemId}
            label={t("lists.editor.pictureFor", { title: picturing.title })}
            picked={picturing.imageUrl}
            onPick={(choice) => handlePicture(picturing.itemId, choice)}
            onClose={() => setPicturing(null)}
          />
        )}

        {pending && notingEntry && (
          <UnsavedNoteDialog
            title={notingEntry.title}
            draft={noteDraft}
            isNew={notingEntry.note === null}
            consequence={
              pending.kind !== "save"
                ? ""
                : list.id === null
                  ? t("lists.editor.continueCreates")
                  : t("lists.editor.continueSaves")
            }
            saveProblem={noteSaveProblem}
            busy={noteBusy}
            onSave={saveNoteAndContinue}
            onDiscard={discardNoteAndContinue}
            onKeepEditing={keepEditingNote}
          />
        )}

        {confirmingRemove && (
          <ConfirmDialog
            title={t("lists.editor.removeConfirm", {
              title: confirmingRemove.title,
            })}
            confirmLabel={t("common.remove")}
            busyLabel={t("common.removing")}
            onConfirm={() => {
              handleRemove(confirmingRemove.itemId);
              setConfirmingRemove(null);
            }}
            onCancel={() => setConfirmingRemove(null)}
          >
            <p>{t("lists.editor.removeNoteToo")}</p>
          </ConfirmDialog>
        )}

        {notice && (
          <p className="text-sm text-muted">
            {notice.text}{" "}
            <button
              type="button"
              onClick={() => goToPage(notice.page)}
              className="underline"
            >
              {t("lists.pager.goToPage", { page: notice.page })}
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
              {t("common.cancel")}
            </button>
          </div>
        )}

        {shownError && <p className="text-sm text-danger">{shownError}</p>}
      </section>
      <section className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => guard({ kind: "save" })}
          disabled={busy}
          className="self-start rounded-lg bg-accent px-6 py-2 text-background disabled:opacity-40"
        >
          {list.id === null
            ? busy
              ? t("auth.creating")
              : t("lists.editor.create")
            : busy
              ? t("common.saving")
              : t("lists.editor.saveDetails")}
        </button>
        {detailsMessage && (
          <p className="text-sm text-danger">{detailsMessage}</p>
        )}
        <p className="text-xs text-muted">
          {list.id === null
            ? t("lists.editor.nobodySees")
            : t("lists.editor.savesDetails")}
        </p>
      </section>
      {list.id !== null && (
        <section className="border-t border-line pt-4">
          <button
            type="button"
            onClick={handleDeleteList}
            className="text-sm text-danger underline"
          >
            {t("lists.editor.deleteList")}
          </button>
        </section>
      )}
    </div>
  );
}
