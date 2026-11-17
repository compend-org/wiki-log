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
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createGroupedList, stageItem } from "@/app/actions";
import ItemImage from "@/components/items/ItemImage";
import ItemPicker from "@/components/items/ItemPicker";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { track } from "@/lib/analytics/analytics";
import {
  SAVE_FAILED,
  userFacingErrorMessage,
} from "@/lib/errors/userFacingErrorMessage";
import { submitOnModEnter } from "@/lib/hooks/submitShortcut";
import { useDragSensors } from "@/lib/hooks/useDragSensors";
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
  removeEntry,
  renameGroup,
  reorderWithin,
} from "@/lib/lists/listGroups";
import { createClient } from "@/lib/supabase/client";

// One item in a group's grid, dragged by its picture or title
function SortableTile({
  entry,
  onRemove,
}: {
  entry: GroupEntry;
  onRemove: () => void;
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
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={`flex cursor-grab touch-manipulation flex-col gap-1 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="relative">
        <ItemImage
          src={entry.imageUrl}
          alt={entry.title}
          className="aspect-square w-full rounded-lg"
        />
        <button
          type="button"
          onClick={onRemove}
          onKeyDown={(e) => e.stopPropagation()}
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
}) {
  const [title, setTitle] = useState<string>(list.title);
  const [description, setDescription] = useState<string>(
    list.description ?? "",
  );
  const [groups, setGroups] = useState<DraftGroup[]>(
    initialGroups.length > 0 ? initialGroups : [emptyGroup()],
  );
  // The group whose item picker is open
  const [adding, setAdding] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [confirmingDelete, setConfirmingDelete] = useState<boolean>(false);
  const [labeled, setLabeled] = useState<boolean>(list.labeled);
  // The item being dragged
  const [activeId, setActiveId] = useState<string | null>(null);
  // Set after an item changes group mid-drag, so it doesn't jump back and
  // forth before the new layout has been measured
  const recentlyMoved = useRef<boolean>(false);
  const router = useRouter();
  const sensors = useDragSensors();

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
      : `Group ${index + 1}`;
  }

  // Called by the picker once it knows the item
  async function handleAdd(itemId: string, key: string) {
    setError("");
    const result = await stageItem(itemId);
    if (result.error || !result.item) {
      setError(result.error ?? "Something went wrong.");
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
      setError(`A grouped list has at most ${MAX_GROUPS} groups.`);
      return;
    }
    const group = emptyGroup();
    setGroups((prev) => [...prev, group]);
  }

  async function save() {
    const t = title.trim();
    if (t.length < 1 || t.length > 80) {
      setMessage("Titles are 1–80 characters.");
      return;
    }
    const problem = groupsProblem(groups, labeled);
    if (problem) {
      setMessage(problem);
      return;
    }
    setBusy(true);
    setMessage("");
    const payload = groupsPayload(groups, labeled);

    if (list.id === null) {
      const result = await createGroupedList({
        title: t,
        description,
        labeled,
        groups: payload,
      });
      if (result.error || !result.id) {
        setBusy(false);
        setMessage(result.error ?? "Couldn't create the list.");
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
      .update({ title: t, description: description.trim() || null })
      .eq("id", list.id);
    if (updateError) {
      setBusy(false);
      setMessage(userFacingErrorMessage(updateError, SAVE_FAILED));
      return;
    }
    const { error: groupsError } = await supabase.rpc("set_list_groups", {
      p_list: list.id,
      p_groups: payload,
    });
    if (groupsError) {
      setBusy(false);
      setMessage(userFacingErrorMessage(groupsError, SAVE_FAILED));
      return;
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
          {list.id === null ? "New grouped list" : "Edit list"}
        </h1>
        <p className="text-sm text-muted">
          Items sit in groups, and aren&apos;t ranked. Drag items to put them in
          order or move them between groups.
        </p>
      </header>

      <div className="flex flex-col gap-3">
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
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={labeled}
            disabled={list.id !== null}
            onChange={(e) => setLabeled(e.target.checked)}
          />
          Label the groups (give each group a name)
        </label>
        {list.id !== null && (
          <p className="text-xs text-muted">
            This is chosen when the list is made, and can&apos;t be changed.
          </p>
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
                  placeholder={`Group ${index + 1} name`}
                  aria-label={`Name of group ${index + 1}`}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 font-semibold text-foreground"
                />
              ) : (
                <h2 className="flex-1 text-sm font-semibold uppercase tracking-wide text-muted">
                  Group {index + 1}
                </h2>
              )}
              <button
                type="button"
                onClick={() =>
                  setGroups((prev) => moveGroup(prev, group.key, -1))
                }
                disabled={index === 0}
                aria-label={`Move ${groupLabel(group, index)} up`}
                title="Move group up"
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
                aria-label={`Move ${groupLabel(group, index)} down`}
                title="Move group down"
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
                aria-label={`Delete ${groupLabel(group, index)}`}
                title={
                  group.items.length > 0
                    ? "Delete group (its items move to a neighbouring group)"
                    : "Delete group"
                }
                className="rounded border border-line px-2 py-1 text-sm text-danger disabled:opacity-40"
              >
                Delete
              </button>
            </div>

            <GroupGrid
              groupKey={group.key}
              items={group.items.map((i) => i.itemId)}
            >
              {group.items.map((entry) => (
                <SortableTile
                  key={entry.itemId}
                  entry={entry}
                  onRemove={() =>
                    setGroups((prev) => removeEntry(prev, entry.itemId))
                  }
                />
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(adding === group.key ? null : group.key);
                    setError("");
                  }}
                  aria-label={`Add an item to ${groupLabel(group, index)}`}
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
                  Cancel
                </button>
              </div>
            )}
          </section>
        ))}
        <DragOverlay>
          {activeEntry && (
            <div className="flex w-24 flex-col gap-1 opacity-90 shadow-lg">
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
        Add a group
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
              ? "Creating…"
              : "Create list"
            : busy
              ? "Saving…"
              : "Save list"}
        </button>
        {message && <p className="text-sm text-danger">{message}</p>}
        <p className="text-xs text-muted">
          {list.id === null
            ? "Nobody sees this list until you create it."
            : "Nothing changes until you save."}
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
    </form>
  );
}
