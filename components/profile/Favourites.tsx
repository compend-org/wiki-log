"use client";

// ABOUTME: A profile's top 5: five slots that the owner fills, clears and gives pictures.
// ABOUTME: While editing, the owner drags an item onto another slot to swap the two.

import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  arraySwap,
  rectSwappingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS, useCombinedRefs } from "@dnd-kit/utilities";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import {
  removeFavourite,
  setFavourite,
  setFavouritePicture,
} from "@/app/actions";
import ItemImage from "@/components/items/ItemImage";
import ItemPicker from "@/components/items/ItemPicker";
import PicturePicker from "@/components/logs/PicturePicker";
import EditIcon from "@/components/ui/EditIcon";
import { track } from "@/lib/analytics/analytics";
import {
  SAVE_FAILED,
  userFacingErrorMessage,
} from "@/lib/errors/userFacingErrorMessage";
import { useDragSensors } from "@/lib/hooks/useDragSensors";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import { isCompoundId } from "@/lib/ids";
import type { PictureChoice } from "@/lib/pictureChoices";
import { createClient } from "@/lib/supabase/client";

export type Slot = {
  itemId: string;
  title: string;
  imageUrl: string | null;
  nsfw: boolean;
};

// One of the five places in the grid. While editing, a filled one can be
// dragged onto another, and any of them can be dropped on.
function SwappableSlot({
  position,
  editing,
  filled,
  children,
}: {
  position: number;
  editing: boolean;
  filled: boolean;
  children: ReactNode;
}) {
  const draggable = editing && filled;
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: position,
    disabled: { draggable: !draggable, droppable: !editing },
  });
  // The whole slot is the activator, so Enter or Space on a button inside it
  // presses that button rather than starting a drag
  const ref = useCombinedRefs(setNodeRef, setActivatorNodeRef);

  return (
    <div
      ref={ref}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 20 : undefined,
      }}
      {...(draggable ? { ...attributes, ...listeners } : {})}
      className={`relative min-w-0 ${
        draggable
          ? "cursor-grab select-none [-webkit-touch-callout:none] active:cursor-grabbing"
          : ""
      }`}
    >
      {children}
    </div>
  );
}

export default function Favourites({
  slots,
  isOwner,
}: {
  slots: (Slot | null)[];
  isOwner: boolean;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [removing, setRemoving] = useState<boolean>(false);
  // The slot whose picture picker is open
  const [picturing, setPicturing] = useState<number | null>(null);
  // Swaps show at once, until the server sends the saved slots
  const [order, setOrder] = useLocalCopy(slots);
  // Slots stay locked after a swap until the server sends them, so a button
  // can't act on a position that holds something else by then
  const [refreshing, startRefresh] = useTransition();
  const saving = busy || refreshing;
  const router = useRouter();
  const sensors = useDragSensors();
  const hasFavourites = slots.some(Boolean);
  const showRemove = removing && hasFavourites;

  async function handlePick(itemId: string) {
    if (editing === null) return;
    setBusy(true);
    setError("");
    const result = await setFavourite({ position: editing, itemId });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    track("favourite_set", { position: editing });
    setEditing(null);
    router.refresh();
  }

  async function handleRemove(position: number) {
    setBusy(true);
    setError("");
    let result: { error?: string };
    try {
      result = await removeFavourite(position);
    } catch {
      // The request can fail outright, e.g. when it races a page change
      result = { error: "Couldn't remove it. Reload the page to try again." };
    }
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    track("favourite_removed", { position });
    router.refresh();
  }

  async function handlePicture(
    position: number,
    itemId: string,
    choice: PictureChoice | null,
  ) {
    setBusy(true);
    setError("");
    let result: { error?: string };
    try {
      // Null is the item's own picture
      result = await setFavouritePicture(
        position,
        itemId,
        choice && !choice.isDefault ? choice.url : null,
      );
    } catch {
      result = { error: "Couldn't save the picture. Try again." };
    }
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    // Ignored while the last change is still being saved
    if (saving || !over || active.id === over.id) return;
    const from = Number(active.id);
    const to = Number(over.id);
    const moved = order[from - 1];
    if (!moved) return;

    const before = order;
    setOrder(arraySwap(order, from - 1, to - 1));
    // The slot being added to may be the one just filled
    setEditing(null);
    setBusy(true);
    setError("");
    const { error } = await createClient().rpc("move_favourite", {
      p_item: moved.itemId,
      p_position: to,
    });
    setBusy(false);
    if (error) {
      setOrder(before);
      setError(userFacingErrorMessage(error, SAVE_FAILED));
      return;
    }
    track("favourites_reordered");
    startRefresh(() => router.refresh());
  }

  const picturingSlot = picturing === null ? null : order[picturing - 1];

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Top 5
        </h2>
        {isOwner && hasFavourites && (
          <button
            type="button"
            onClick={() => {
              setRemoving((r) => !r);
              setError("");
            }}
            className="text-sm text-muted hover:text-accent"
          >
            {showRemove ? "Done" : "Edit"}
          </button>
        )}
      </div>

      <DndContext
        id="favourites"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={order.map((_, i) => i + 1)}
          strategy={rectSwappingStrategy}
        >
          <div aria-busy={saving} className="grid grid-cols-5 gap-2">
            {order.map((slot, i) => {
              const position = i + 1;

              return (
                <SwappableSlot
                  key={position}
                  position={position}
                  editing={showRemove}
                  filled={Boolean(slot)}
                >
                  {slot ? (
                    <>
                      {/* While removing, the image isn't a link, so a missed tap
                    can't navigate away mid-request */}
                      {showRemove ? (
                        <ItemImage
                          src={slot.imageUrl}
                          nsfw={slot.nsfw}
                          alt={slot.title}
                          className="aspect-square w-full rounded"
                        />
                      ) : (
                        <Link
                          href={`/item/${slot.itemId}`}
                          title={slot.title}
                          className="block transition-transform hover:-translate-y-0.5"
                        >
                          <ItemImage
                            src={slot.imageUrl}
                            nsfw={slot.nsfw}
                            alt={slot.title}
                            className="aspect-square w-full rounded"
                          />
                        </Link>
                      )}

                      {showRemove && (
                        <button
                          type="button"
                          onClick={() => handleRemove(position)}
                          disabled={saving}
                          aria-label={`Remove ${slot.title}`}
                          className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-background text-sm text-foreground shadow disabled:opacity-40"
                        >
                          ×
                        </button>
                      )}
                      {showRemove && !isCompoundId(slot.itemId) && (
                        <button
                          type="button"
                          onClick={() => setPicturing(position)}
                          disabled={saving}
                          aria-label={`Change the picture for ${slot.title}`}
                          title="Change the picture"
                          className="absolute bottom-6 left-1 rounded bg-background/80 px-1.5 py-1 disabled:opacity-40"
                        >
                          <EditIcon className="h-3 w-3" />
                        </button>
                      )}
                      <span
                        className="block truncate text-xs"
                        title={slot.title}
                      >
                        {slot.title}
                      </span>
                    </>
                  ) : isOwner ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(position);
                        setError("");
                      }}
                      aria-label={`Add an item to slot ${position}`}
                      className={`flex aspect-square w-full items-center justify-center rounded-lg border-2 border-dashed text-xl transition-colors hover:border-accent hover:text-accent ${
                        editing === position
                          ? "border-accent text-accent"
                          : "border-line text-muted"
                      }`}
                    >
                      +
                    </button>
                  ) : (
                    <div className="aspect-square rounded-lg border-2 border-dashed border-line" />
                  )}
                </SwappableSlot>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {isOwner && editing !== null && (
        <div className="mt-3 flex flex-col gap-2">
          <ItemPicker
            onPick={handlePick}
            placeholder={`Search for slot ${editing}…`}
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setError("");
            }}
            className="self-start rounded-lg border border-line px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      {picturing !== null && picturingSlot && (
        <PicturePicker
          itemId={picturingSlot.itemId}
          label={`Picture for “${picturingSlot.title}” in your top 5`}
          picked={picturingSlot.imageUrl}
          onPick={(choice) =>
            handlePicture(picturing, picturingSlot.itemId, choice)
          }
          onClose={() => setPicturing(null)}
        />
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}
