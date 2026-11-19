// ABOUTME: Where a list's owner writes, changes or removes one item's note in the list editor.
// ABOUTME: Opens inside the grid under the item's row on wider screens, and as a sheet above the keyboard on phones.
"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import ItemImage from "@/components/items/ItemImage";
import NoteField from "@/components/lists/NoteField";
import { submitOnModEnter } from "@/lib/hooks/submitShortcut";
import { useKeyboardInset } from "@/lib/hooks/useKeyboardInset";
import { cleanListNote, noteProblem } from "@/lib/lists/listNotes";

// Columns of the editor's grid from the sm breakpoint up, where the box opens
// in the grid
export const WIDE_COLUMNS = 4;

export default function NoteBox({
  title,
  rank,
  imageUrl,
  column,
  draft,
  onDraft,
  hasNote,
  busy,
  error,
  onSave,
  onRemove,
  onCancel,
  onDismiss,
}: {
  title: string;
  // Shown before the title on ranked lists
  rank: number | null;
  imageUrl: string | null;
  // The item's column in the wide grid, for the notch that points at it
  column: number;
  draft: string;
  onDraft: (draft: string) => void;
  // Whether the item has a saved note, which can be removed
  hasNote: boolean;
  busy: boolean;
  error: string;
  onSave: () => void;
  onRemove: () => void;
  onCancel: () => void;
  // A tap outside the sheet on phones
  onDismiss: () => void;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const keyboard = useKeyboardInset();
  const heading = t("lists.notes.noteFor", {
    rank: rank === null ? "" : `#${format.number(rank)} `,
    title,
  });
  const cannotSave =
    busy || cleanListNote(draft) === null || noteProblem(draft) !== null;

  return (
    // On phones the sheet is fixed to the screen, so it takes no room in the grid
    <li className="contents sm:col-span-4 sm:block">
      <button
        type="button"
        aria-label={t("common.close")}
        onClick={() => {
          if (!busy) onDismiss();
        }}
        className="fixed inset-0 z-40 cursor-default bg-black/40 sm:hidden"
      />
      <form
        aria-label={heading}
        data-note-box
        onSubmit={(e) => {
          e.preventDefault();
          if (!cannotSave) onSave();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            if (!busy) onCancel();
            return;
          }
          submitOnModEnter(e);
        }}
        style={{ "--keyboard": `${keyboard}px` } as CSSProperties}
        className="card fixed inset-x-0 bottom-[var(--keyboard)] z-50 flex flex-col gap-2 rounded-t-xl border-x-0 border-b-0 border-dashed p-4 text-sm sm:relative sm:inset-auto sm:bottom-auto sm:z-auto sm:mt-1 sm:rounded-none sm:border-2 sm:p-3"
      >
        <span
          aria-hidden="true"
          style={{ left: `${((column + 0.5) * 100) / WIDE_COLUMNS}%` }}
          className="absolute -top-[9px] hidden h-4 w-4 -translate-x-1/2 rotate-45 border-l-2 border-t-2 border-dashed border-line bg-background sm:block"
        />
        <div className="flex items-center gap-2">
          <div className="w-8 shrink-0 sm:hidden">
            <ItemImage src={imageUrl} alt="" className="aspect-square w-8" />
          </div>
          <h3 className="font-semibold">{heading}</h3>
        </div>

        <NoteField
          label={heading}
          value={draft}
          onChange={onDraft}
          autoFocus
          rows={4}
          readOnly={busy}
        />

        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            data-submit
            disabled={cannotSave}
            className="min-h-11 rounded-lg bg-accent px-4 text-background disabled:opacity-40 sm:min-h-0 sm:px-3 sm:py-1"
          >
            {busy ? t("common.saving") : t("lists.picker.saveNote")}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-11 rounded-lg border border-line px-4 disabled:opacity-40 sm:min-h-0 sm:px-3 sm:py-1"
          >
            {t("common.cancel")}
          </button>
          <span className="hidden text-xs text-muted sm:inline">
            {t("lists.notes.shortcuts")}
          </span>
          {hasNote && (
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="order-first mr-auto min-h-11 text-danger underline disabled:opacity-40 sm:order-last sm:ml-auto sm:mr-0 sm:min-h-0"
            >
              {t("lists.notes.remove")}
            </button>
          )}
        </div>
      </form>
    </li>
  );
}
