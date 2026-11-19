"use client";

import {
  type CollisionDetection,
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  pointerWithin,
  useDroppable,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  createGroupedList,
  setListItemPicture,
  stageItem,
} from "@/app/actions";
import ItemImage from "@/components/items/ItemImage";
import ItemPicker from "@/components/items/ItemPicker";
import NoteBox, { WIDE_COLUMNS } from "@/components/lists/NoteBox";
import NoteButton from "@/components/lists/NoteButton";
import PicturePicker from "@/components/logs/PicturePicker";
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
import {
  type CreatorDraft,
  flattenGroups,
  keptPictures,
} from "@/lib/lists/creatorDraft";
import {
  addEntry,
  type DraftGroup,
  deleteGroup,
  emptyGroup,
  type GroupEntry,
  groupItemCount,
  groupKeyOf,
  groupsPayload,
  groupsProblem,
  MAX_GROUP_NAME,
  MAX_GROUPS,
  moveEntryTo,
  moveGroup,
  notesPayload,
  removeEntry,
  renameGroup,
  reorderWithin,
  setEntryNote,
} from "@/lib/lists/listGroups";
import { cleanListNote, noteProblem } from "@/lib/lists/listNotes";
import type { PictureChoice } from "@/lib/pictureChoices";
import { createClient } from "@/lib/supabase/client";

// One item in a group's grid, dragged by its picture or title
function SortableTile({
  entry,
  noting,
  onRemove,
  onPicture,
  onNote,
}: {
  entry: GroupEntry;
  // Whether the item's note is open
  noting: boolean;
  onRemove: () => void;
  // Opens the picture picker
  onPicture: () => void;
  // Opens or closes the item's note
  onNote: () => void;
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
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={`relative flex cursor-grab select-none flex-col gap-1 [-webkit-touch-callout:none] active:cursor-grabbing ${
        // The picture that follows the pointer is drawn by the overlay; this
        // tile only holds the place the item will drop into
        isDragging ? "invisible" : ""
      }`}
    >
      <div className="relative">
        <ItemImage
          src={entry.imageUrl}
          alt={entry.title}
          className="aspect-square w-full rounded-lg"
        />
        {!isCompoundId(entry.itemId) && (
          // Compounds have no article to pick a picture from
          <button
            type="button"
            onClick={onPicture}
            onKeyDown={(e) => e.stopPropagation()}
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
          onClick={onRemove}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label={t("lists.editor.removeItem", { title: entry.title })}
          className="absolute right-1 top-1 rounded bg-background/80 px-1.5 text-sm"
        >
          ×
        </button>
      </div>
      <span className="truncate text-xs">{entry.title}</span>
      <NoteButton
        entry={entry}
        editing={noting}
        onNote={onNote}
        onKeyDown={(e) => e.stopPropagation()}
      />
    </li>
  );
}

// A group's grid of items. It accepts drops itself, so an item can be dropped
// into an empty group or after the last item.
function GroupGrid({
  groupKey,
  items,
  children,
}: {
  groupKey: string;
  items: string[];
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: groupKey });
  return (
    <SortableContext items={items} strategy={rectSortingStrategy}>
      <ul ref={setNodeRef} className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {children}
      </ul>
    </SortableContext>
  );
}

// Makes and edits grouped lists. Everything is kept here until Save, which
// stores the whole list at once.
export default function GroupedListEditor({
  list,
  ownerName,
  initialGroups,
  initialPictures,
  onDraft,
}: {
  list: {
    id: string | null;
    title: string;
    description: string | null;
    // Whether the groups have names (chosen when the list is made)
    labeled: boolean;
  };
  ownerName: string;
  initialGroups: DraftGroup[];
  // The pictures picked, when the list is carried over from another kind
  initialPictures?: Record<string, string>;
  // Told what the list holds whenever it changes, so it can be carried to
  // another kind of list
  onDraft?: (draft: CreatorDraft) => void;
}) {
  const t = useTranslations();
  const [title, setTitle] = useState<string>(list.title);
  const [description, setDescription] = useState<string>(
    list.description ?? "",
  );
  const [groups, setGroups] = useState<DraftGroup[]>(
    initialGroups.length > 0 ? initialGroups : [emptyGroup()],
  );
  // The group whose item picker is open
  const [adding, setAdding] = useState<string | null>(null);
  // Pictures picked from the items' articles, by item: the picture to store,
  // or null to go back to the item's own. They are saved with the list.
  const [pictures, setPictures] = useState<Record<string, string | null>>(
    initialPictures ?? {},
  );
  // The item whose picture picker is open
  const [picturing, setPicturing] = useState<GroupEntry | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [confirmingDelete, setConfirmingDelete] = useState<boolean>(false);
  const [labeled, setLabeled] = useState<boolean>(list.labeled);
  // The item whose note is open, and what's typed in it. A note is kept
  // with the other changes until Save.
  const [noting, setNoting] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>("");
  // The item being dragged
  const [activeId, setActiveId] = useState<string | null>(null);
  // Set after an item changes group mid-drag, so it doesn't jump back and
  // forth before the new layout has been measured
  const recentlyMoved = useRef<boolean>(false);
  const router = useRouter();
  const sensors = useDragSensors();

  // The list's contents are passed on as they change
  useEffect(() => {
    onDraft?.({
      title,
      description,
      items: flattenGroups(groups),
      pictures: keptPictures(pictures),
    });
  }, [onDraft, title, description, groups, pictures]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs after every change to the groups
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      recentlyMoved.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [groups]);

  const activeEntry =
    groups.flatMap((g) => g.items).find((i) => i.itemId === activeId) ?? null;
  const total = groupItemCount(groups);

  function groupLabel(group: DraftGroup, index: number): string {
    return labeled && group.name.trim()
      ? group.name.trim()
      : t("lists.grouped.group", { number: index + 1 });
  }

  // The groups with the open note's typed text kept in them, or null if it
  // can't be kept. Empty text keeps the note as it was; Remove note removes it.
  function withOpenNote(current: DraftGroup[]): DraftGroup[] | null {
    if (noting === null) return current;
    if (noteProblem(noteDraft)) return null;
    const note = cleanListNote(noteDraft);
    return note === null ? current : setEntryNote(current, noting, note);
  }

  // Opens an item's note, keeping the one that was open. Clicking the open
  // item's note closes it.
  function toggleNote(entry: GroupEntry) {
    const kept = withOpenNote(groups);
    if (kept === null) return;
    setGroups(kept);
    if (noting === entry.itemId) {
      setNoting(null);
      return;
    }
    const current = kept
      .flatMap((g) => g.items)
      .find((i) => i.itemId === entry.itemId);
    setNoting(entry.itemId);
    setNoteDraft(current?.note ?? "");
    setError("");
  }

  function closeNote() {
    setNoting(null);
    setNoteDraft("");
  }

  // Tapping outside the sheet on a phone keeps what was typed, if it can be
  function dismissNote() {
    const kept = withOpenNote(groups);
    if (kept !== null) setGroups(kept);
    closeNote();
  }

  function saveNote() {
    const kept = withOpenNote(groups);
    if (kept === null) return;
    setGroups(kept);
    closeNote();
  }

  function removeNote() {
    if (noting === null) return;
    setGroups((prev) => setEntryNote(prev, noting, null));
    closeNote();
  }

  // Called by the picker once it knows the item
  async function handleAdd(itemId: string, key: string) {
    setError("");
    const result = await stageItem(itemId);
    if (result.error || !result.item) {
      setError(result.error ?? t("common.somethingWentWrong"));
      return;
    }
    const entry: GroupEntry = result.item;
    setGroups((prev) => addEntry(prev, entry, key));
    setAdding(null);
  }

  // Goes by where the pointer is. Over a group but not over one of its items
  // (an empty group, or a gap), the nearest item in that group is the target,
  // or the group itself if it has none.
  const collisionDetection: CollisionDetection = (args) => {
    const hits = pointerWithin(args);
    if (hits.length === 0) return closestCorners(args);
    const groupKeys = new Set(groups.map((g) => g.key));
    if (hits.some((h) => !groupKeys.has(String(h.id)))) return hits;
    const group = groups.find((g) => g.key === String(hits[0].id));
    const own = new Set([
      group?.key,
      ...(group?.items.map((i) => i.itemId) ?? []),
    ]);
    return closestCorners({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) =>
        own.has(String(c.id)),
      ),
    });
  };

  // Shows the picked picture at once and keeps it for when the list is saved
  function handlePicture(itemId: string, choice: PictureChoice | null) {
    setError("");
    // Null is the item's own picture
    const stored = choice && !choice.isDefault ? choice.url : null;
    const shown = choice?.url ?? null;
    setPictures((prev) => ({ ...prev, [itemId]: stored }));
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        items: g.items.map((i) =>
          i.itemId === itemId ? { ...i, imageUrl: shown } : i,
        ),
      })),
    );
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  // Dragging over another group takes the item into it right away, at the
  // place it hovers, so the group opens a gap for it
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over || recentlyMoved.current) return;
    const itemId = String(active.id);
    const overId = String(over.id);
    const from = groupKeyOf(groups, itemId);
    const to = groupKeyOf(groups, overId);
    if (from === null || to === null || from === to) return;

    const target = groups.find((g) => g.key === to);
    if (!target) return;
    let index = target.items.length;
    if (overId !== to) {
      const overIndex = target.items.findIndex((i) => i.itemId === overId);
      const dragged = active.rect.current.translated;
      const after = dragged !== null && dragged.left > over.rect.left;
      index = overIndex + (after ? 1 : 0);
    }
    recentlyMoved.current = true;
    setGroups((prev) => moveEntryTo(prev, itemId, to, index));
  }

  // Dropping inside the group the item is in puts it where it was dropped
  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const itemId = String(active.id);
    const overId = String(over.id);
    if (itemId === overId) return;
    const key = groupKeyOf(groups, itemId);
    if (key === null || key !== groupKeyOf(groups, overId)) return;
    setGroups((prev) =>
      overId === key
        ? moveEntryTo(prev, itemId, key, Number.MAX_SAFE_INTEGER)
        : reorderWithin(prev, itemId, overId),
    );
  }

  function handleAddGroup() {
    setError("");
    if (groups.length >= MAX_GROUPS) {
      setError(t("lists.grouped.tooMany", { max: MAX_GROUPS }));
      return;
    }
    const group = emptyGroup();
    setGroups((prev) => [...prev, group]);
  }

  async function save() {
    const trimmed = title.trim();
    if (trimmed.length < 1 || trimmed.length > 80) {
      setMessage(t("errors.titleLength"));
      return;
    }
    const problem = groupsProblem(groups, labeled);
    if (problem) {
      setMessage(problem);
      return;
    }
    // A note being typed is saved with the list
    const toSave = withOpenNote(groups);
    if (toSave === null) {
      setMessage(noteProblem(noteDraft) ?? "");
      return;
    }
    setBusy(true);
    setMessage("");
    const payload = groupsPayload(toSave, labeled);
    const notes = notesPayload(toSave);

    if (list.id === null) {
      const result = await createGroupedList({
        title: trimmed,
        description,
        labeled,
        groups: payload,
        notes,
        pictures: Object.fromEntries(
          Object.entries(pictures).filter(
            (entry): entry is [string, string] => entry[1] !== null,
          ),
        ),
      });
      if (result.error || !result.id) {
        setBusy(false);
        setMessage(result.error ?? t("errors.listCreateFailed"));
        return;
      }
      track("list_created", {
        item_count: total,
        ranked: false,
        grouped: true,
      });
      router.push(`/list/${result.id}`);
      router.refresh();
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("lists")
      .update({ title: trimmed, description: description.trim() || null })
      .eq("id", list.id);
    if (updateError) {
      setBusy(false);
      setMessage(userFacingErrorMessage(updateError, SAVE_FAILED));
      return;
    }
    const { error: groupsError } = await supabase.rpc("set_list_groups", {
      p_list: list.id,
      p_groups: payload,
      p_notes: notes,
    });
    if (groupsError) {
      setBusy(false);
      setMessage(userFacingErrorMessage(groupsError, SAVE_FAILED));
      return;
    }
    // Only the server may set an entry's picture
    for (const [itemId, url] of Object.entries(pictures)) {
      const { error: pictureError } = await setListItemPicture(
        list.id,
        itemId,
        url,
      );
      if (pictureError) {
        setBusy(false);
        setMessage(
          t("errors.listSavedPicturesFailed", { error: pictureError }),
        );
        return;
      }
    }
    track("list_edited", { item_count: total, ranked: false, grouped: true });
    router.push(`/list/${list.id}`);
    router.refresh();
  }

  async function handleDeleteList() {
    if (list.id === null) return;
    setBusy(true);
    setError("");
    const { error: deleteError } = await createClient()
      .from("lists")
      .delete()
      .eq("id", list.id);
    if (deleteError) {
      setBusy(false);
      setError(
        userFacingErrorMessage(deleteError, t("errors.listDeleteFailed")),
      );
      return;
    }
    track("list_deleted");
    router.push(`/u/${encodeURIComponent(ownerName)}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onKeyDown={submitOnModEnter}
      className="flex flex-col gap-6"
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">
          {list.id === null ? t("lists.grouped.newTitle") : t("lists.editList")}
        </h1>
        <p className="text-sm text-muted">{t("lists.grouped.intro")}</p>
      </header>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t("lists.editor.titleLabel")}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("lists.editor.descriptionLabel")}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={2}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-foreground"
          />
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={labeled}
            disabled={list.id !== null}
            onChange={(e) => setLabeled(e.target.checked)}
          />
          {t("lists.grouped.labelGroups")}
        </label>
        {list.id !== null && (
          <p className="text-xs text-muted">{t("lists.grouped.labelFixed")}</p>
        )}
      </div>

      <DndContext
        id="grouped-list-editor"
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        {groups.map((group, index) => (
          <section
            key={group.key}
            className="flex flex-col gap-3 rounded-lg border border-line p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              {labeled ? (
                <input
                  value={group.name}
                  onChange={(e) =>
                    setGroups((prev) =>
                      renameGroup(prev, group.key, e.target.value),
                    )
                  }
                  maxLength={MAX_GROUP_NAME}
                  onKeyDown={(e) => {
                    // Enter in a name shouldn't save the list
                    if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
                      e.preventDefault();
                    }
                  }}
                  placeholder={t("lists.grouped.groupNamePlaceholder", {
                    number: index + 1,
                  })}
                  aria-label={t("lists.grouped.groupNameLabel", {
                    number: index + 1,
                  })}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 font-semibold text-foreground"
                />
              ) : (
                <h2 className="flex-1 text-sm font-semibold uppercase tracking-wide text-muted">
                  {t("lists.grouped.group", { number: index + 1 })}
                </h2>
              )}
              <button
                type="button"
                onClick={() =>
                  setGroups((prev) => moveGroup(prev, group.key, -1))
                }
                disabled={index === 0}
                aria-label={t("lists.grouped.moveUp", {
                  group: groupLabel(group, index),
                })}
                title={t("lists.grouped.moveUpTitle")}
                className="rounded border border-line px-2 py-1 text-sm disabled:opacity-40"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() =>
                  setGroups((prev) => moveGroup(prev, group.key, 1))
                }
                disabled={index === groups.length - 1}
                aria-label={t("lists.grouped.moveDown", {
                  group: groupLabel(group, index),
                })}
                title={t("lists.grouped.moveDownTitle")}
                className="rounded border border-line px-2 py-1 text-sm disabled:opacity-40"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() =>
                  setGroups((prev) => deleteGroup(prev, group.key))
                }
                disabled={groups.length <= 1}
                aria-label={t("lists.grouped.deleteGroup", {
                  group: groupLabel(group, index),
                })}
                title={
                  group.items.length > 0
                    ? t("lists.grouped.deleteGroupTitleWithItems")
                    : t("lists.grouped.deleteGroupTitle")
                }
                className="rounded border border-line px-2 py-1 text-sm text-danger disabled:opacity-40"
              >
                {t("common.delete")}
              </button>
            </div>

            <GroupGrid
              groupKey={group.key}
              items={group.items.map((i) => i.itemId)}
            >
              {group.items.flatMap((entry, itemIndex) => {
                // The last tile in the wide grid's row holding the open
                // note's item, which the note box opens after
                const notingIndex = group.items.findIndex(
                  (i) => i.itemId === noting,
                );
                const rowEnd =
                  notingIndex < 0
                    ? -1
                    : Math.min(
                        group.items.length - 1,
                        Math.floor(notingIndex / WIDE_COLUMNS) * WIDE_COLUMNS +
                          WIDE_COLUMNS -
                          1,
                      );
                const open = group.items[notingIndex];
                return [
                  <SortableTile
                    key={entry.itemId}
                    entry={entry}
                    noting={entry.itemId === noting}
                    onRemove={() => {
                      setGroups((prev) => removeEntry(prev, entry.itemId));
                      setPictures(({ [entry.itemId]: _, ...others }) => others);
                      if (noting === entry.itemId) closeNote();
                    }}
                    onPicture={() => setPicturing(entry)}
                    onNote={() => toggleNote(entry)}
                  />,
                  ...(itemIndex === rowEnd && open
                    ? [
                        <NoteBox
                          key={`note-${open.itemId}`}
                          title={open.title}
                          rank={null}
                          imageUrl={open.imageUrl}
                          column={notingIndex % WIDE_COLUMNS}
                          draft={noteDraft}
                          onDraft={setNoteDraft}
                          hasNote={Boolean(open.note)}
                          busy={false}
                          error=""
                          onSave={saveNote}
                          onRemove={removeNote}
                          onCancel={closeNote}
                          onDismiss={dismissNote}
                        />,
                      ]
                    : []),
                ];
              })}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(adding === group.key ? null : group.key);
                    setError("");
                  }}
                  aria-label={t("lists.grouped.addItemTo", {
                    group: groupLabel(group, index),
                  })}
                  className={`flex aspect-square w-full items-center justify-center rounded-lg border-2 border-dashed text-5xl transition-colors hover:border-accent hover:text-accent ${
                    adding === group.key
                      ? "border-accent text-accent"
                      : "border-line text-muted"
                  }`}
                >
                  +
                </button>
              </li>
            </GroupGrid>

            {adding === group.key && (
              <div className="flex flex-col gap-2">
                <ItemPicker
                  onPick={(itemId) => handleAdd(itemId, group.key)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setAdding(null)}
                  className="self-start rounded-lg border border-line px-3 py-1.5 text-sm"
                >
                  {t("common.cancel")}
                </button>
              </div>
            )}
          </section>
        ))}
        <DragOverlay>
          {activeEntry && (
            <div className="flex cursor-grabbing select-none flex-col gap-1 opacity-60">
              <ItemImage
                src={activeEntry.imageUrl}
                alt={activeEntry.title}
                className="aspect-square w-full rounded-lg"
              />
              <span className="truncate text-xs">{activeEntry.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <button
        type="button"
        onClick={handleAddGroup}
        disabled={groups.length >= MAX_GROUPS}
        className="self-start rounded-lg border border-line px-4 py-2 text-sm disabled:opacity-40"
      >
        {t("lists.grouped.addGroup")}
      </button>

      {error && <p className="text-sm text-danger">{error}</p>}

      <section className="flex flex-col gap-2">
        <button
          type="submit"
          data-submit
          disabled={busy}
          className="self-start rounded-lg bg-accent px-6 py-2 text-background disabled:opacity-40"
        >
          {list.id === null
            ? busy
              ? t("auth.creating")
              : t("lists.editor.create")
            : busy
              ? t("common.saving")
              : t("lists.editor.saveList")}
        </button>
        {message && <p className="text-sm text-danger">{message}</p>}
        <p className="text-xs text-muted">
          {list.id === null
            ? t("lists.editor.nobodySees")
            : t("lists.editor.nothingUntilSave")}
        </p>
      </section>

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
      {picturing && (
        <PicturePicker
          itemId={picturing.itemId}
          label={t("lists.editor.pictureFor", { title: picturing.title })}
          picked={picturing.imageUrl}
          onPick={(choice) => handlePicture(picturing.itemId, choice)}
          onClose={() => setPicturing(null)}
        />
      )}
    </form>
  );
}
