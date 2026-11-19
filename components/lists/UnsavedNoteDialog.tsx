// ABOUTME: Asks what to do with a note that has unsaved changes before doing something else.
// ABOUTME: Save it and go on, throw the changes away and go on, or go back to the note.
"use client";

import { useTranslations } from "next-intl";
import Dialog from "@/components/ui/Dialog";

export default function UnsavedNoteDialog({
  title,
  draft,
  isNew,
  consequence,
  saveProblem,
  busy,
  onSave,
  onDiscard,
  onKeepEditing,
}: {
  // The item the note is for
  title: string;
  draft: string;
  // Whether the item had no note before
  isNew: boolean;
  // What going on does, such as "Continuing saves the list's details and
  // opens the list."
  consequence: string;
  // Why the draft can't be saved, if it can't
  saveProblem: string | null;
  busy: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onKeepEditing: () => void;
}) {
  const t = useTranslations();
  const heading = isNew
    ? t("lists.notes.unsavedNewTitle", { title })
    : t("lists.notes.unsavedChangeTitle", { title });
  return (
    <Dialog label={heading} onClose={onKeepEditing}>
      <h2 className="text-base font-semibold">{heading}</h2>
      {draft.trim() && (
        <p className="line-clamp-2 whitespace-pre-wrap break-words border-l-4 border-line pl-2">
          {draft.trim()}
        </p>
      )}
      <p className="text-muted">
        {consequence}{" "}
        {isNew
          ? t("lists.notes.discardNew", { title })
          : t("lists.notes.discardChange", { title })}
      </p>
      {saveProblem && <p className="text-danger">{saveProblem}</p>}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={busy || saveProblem !== null}
          className="min-h-11 rounded-lg bg-accent px-3 text-background disabled:opacity-40"
        >
          {busy ? t("common.saving") : t("lists.notes.saveAndContinue")}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          disabled={busy}
          className="min-h-11 rounded-lg border border-line px-3 disabled:opacity-40"
        >
          {isNew
            ? t("lists.notes.discardNoteAndContinue")
            : t("lists.notes.discardChangesAndContinue")}
        </button>
        <button
          type="button"
          onClick={onKeepEditing}
          className="min-h-11 text-accent underline"
        >
          {t("lists.notes.keepEditing")}
        </button>
      </div>
    </Dialog>
  );
}
