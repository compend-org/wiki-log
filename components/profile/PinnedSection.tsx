"use client";

// ABOUTME: The Pinned section of a profile: its heading, its first few cards, and for the owner an Edit mode.
// ABOUTME: Edit shows every pinned card with a handle at its left, to drag the pins into another order.

import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { track } from "@/lib/analytics/analytics";
import {
  SAVE_FAILED,
  userFacingErrorMessage,
} from "@/lib/errors/userFacingErrorMessage";
import { useDragSensors } from "@/lib/hooks/useDragSensors";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import { createClient } from "@/lib/supabase/client";

// One pin and its card. The card is null when the viewer hides it, such as a
// review of an adult item.
export type PinnedCard = { id: string; card: ReactNode };

function SortableCard({
  pin,
  editing,
  fadeIn,
}: {
  pin: PinnedCard;
  editing: boolean;
  // Whether the card fades in as it appears
  fadeIn: boolean;
}) {
  const t = useTranslations();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pin.id, disabled: !editing });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
      }}
      className="relative"
    >
      <div
        className={`flex items-stretch ${isDragging ? "opacity-60" : ""} ${
          fadeIn ? "transition-opacity duration-300 starting:opacity-0" : ""
        }`}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={t("profile.dragToReorder")}
          aria-hidden={!editing}
          tabIndex={editing ? 0 : -1}
          className={`flex shrink-0 cursor-grab touch-none items-center overflow-hidden text-muted transition-[width,opacity] duration-300 active:cursor-grabbing ${
            editing ? "w-7 opacity-100" : "w-0 opacity-0"
          }`}
        >
          <span aria-hidden="true">⠿</span>
        </button>
        <div className="min-w-0 flex-1">{pin.card}</div>
      </div>
    </div>
  );
}

export default function PinnedSection({
  profileHref,
  pins,
  shownCount,
  editable,
}: {
  profileHref: string;
  // The pins in order: all of them for the owner, or the first few
  pins: PinnedCard[];
  // How many of the first pins show when not editing
  shownCount: number;
  // Whether the person looking owns the pins and can reorder them
  editable: boolean;
}) {
  const t = useTranslations();
  // Moves show at once and stay after editing, until the server sends the
  // saved order
  const [order, setOrder] = useLocalCopy(pins);
  const [editing, setEditing] = useState<boolean>(false);
  const [moved, setMoved] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const router = useRouter();
  const sensors = useDragSensors();

  const firstShown = order.slice(0, shownCount);
  const shown = (editing ? order : firstShown).filter((p) => p.card);

  function finishEditing() {
    setEditing(false);
    setError("");
    // The lists and reviews below leave out whichever pins are now first
    if (moved) router.refresh();
    setMoved(false);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    // Ignored while the last move is still being saved
    if (busy || !over || active.id === over.id) return;
    // Places among every pin, hidden ones too, as the database counts them
    const from = order.findIndex((p) => p.id === active.id);
    const to = order.findIndex((p) => p.id === over.id);
    if (from < 0 || to < 0) return;

    const before = order;
    setOrder(arrayMove(order, from, to));
    setError("");
    setBusy(true);
    const { error } = await createClient().rpc("move_pin", {
      p_pin: String(active.id),
      p_position: to + 1,
    });
    setBusy(false);
    if (error) {
      setOrder(before);
      setError(userFacingErrorMessage(error, SAVE_FAILED));
      return;
    }
    track("pins_reordered");
    setMoved(true);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          <Link
            href={`${profileHref}/pinned`}
            className="hover:text-foreground hover:underline"
          >
            {t("profile.pinned")} <span aria-hidden="true">›</span>
          </Link>
        </h2>
        {editable && order.filter((p) => p.card).length > 1 && (
          <button
            type="button"
            onClick={editing ? finishEditing : () => setEditing(true)}
            // Done waits for the last move to be saved, so the refresh after
            // it has the new order
            disabled={busy}
            className="text-sm underline disabled:opacity-60"
          >
            {editing ? t("lists.picker.done") : t("common.edit")}
          </button>
        )}
      </div>
      <DndContext
        id="pinned"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={shown.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div aria-busy={busy} className="flex flex-col gap-3">
            {shown.map((pin) => (
              <SortableCard
                key={pin.id}
                pin={pin}
                editing={editing}
                fadeIn={editing && !firstShown.includes(pin)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
