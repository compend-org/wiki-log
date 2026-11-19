// ABOUTME: Under a list item's tile in an editor: its note, which opens it for editing, or a button to add one.
// ABOUTME: Shared by the plain list editor and the grouped list editor.
"use client";

import { useTranslations } from "next-intl";
import type { KeyboardEventHandler } from "react";

// Under each tile: the note, which opens it for editing, or a box to add one
export default function NoteButton({
  entry,
  editing,
  onNote,
  onKeyDown,
}: {
  entry: { itemId: string; title: string; note?: string | null };
  editing: boolean;
  onNote: () => void;
  // For a tile that is dragged with the keyboard, so keys here don't start a drag
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
}) {
  const t = useTranslations();
  const common = {
    type: "button" as const,
    "data-note-button": entry.itemId,
    "aria-expanded": editing,
    onClick: onNote,
    onKeyDown,
  };
  if (editing) {
    return (
      <button
        {...common}
        aria-label={t("lists.editor.closeNote", { title: entry.title })}
        className="min-h-11 text-left text-xs italic text-muted"
      >
        {t("lists.editor.editingNote")}
      </button>
    );
  }
  if (entry.note) {
    return (
      <button
        {...common}
        aria-label={t("lists.editor.editNote", { title: entry.title })}
        className="min-h-11 text-left text-xs text-accent"
      >
        <span className="line-clamp-2 break-words">{entry.note}</span>
      </button>
    );
  }
  return (
    <button
      {...common}
      aria-label={t("lists.editor.addNoteFor", { title: entry.title })}
      className="min-h-11 rounded-lg border border-dashed border-line px-2 text-left text-xs text-accent"
    >
      {t("lists.editor.addNote")}
    </button>
  );
}
