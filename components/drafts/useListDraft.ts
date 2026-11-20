// ABOUTME: Keeps a list being made saved as a draft: autosaves it, saves it on request, and deletes it.
// ABOUTME: Shared by the plain and grouped list editors; does nothing when editing a published list.
"use client";

import { deleteListDraft, saveListDraft } from "@/app/draftActions";
import { track } from "@/lib/analytics/analytics";
import type { ListDraftFields } from "@/lib/drafts";
import { useAutosave } from "@/lib/hooks/useAutosave";

// The draft a new list is kept in, which the new-list page holds on to so the
// draft survives switching between a plain and a grouped list
export type ListDraftSession = {
  id: string;
  savedAt: string | null;
  // Whether the editor opened a saved draft, which gets a line saying so
  resumed: boolean;
  onSaved: (savedAt: string) => void;
  // The draft was deleted, so the editor starts over empty
  onDeleted: () => void;
};

export function useListDraft(
  session: ListDraftSession | null,
  fields: ListDraftFields,
  {
    worthStarting,
    paused,
  }: {
    // Whether the list holds enough to start a draft
    worthStarting: boolean;
    // While true, changes wait to be saved
    paused: boolean;
  },
) {
  const autosave = useAutosave({
    value: fields,
    savedAt: session?.savedAt ?? null,
    save: (value, savedAt) =>
      session
        ? saveListDraft({ ...value, id: session.id, savedAt })
        : Promise.resolve({ error: "Only a new list is kept as a draft." }),
    onSaved: (savedAt) => session?.onSaved(savedAt),
    worthStarting: session !== null && worthStarting,
    paused,
  });

  return {
    state: autosave.state,
    savedAt: session?.savedAt ?? null,
    async saveNow() {
      if (await autosave.saveNow()) track("draft_saved", { kind: "list" });
    },
    async deleteDraft(): Promise<{ error?: string }> {
      if (!session) return {};
      const savedAt = await autosave.settle();
      if (savedAt) {
        const result = await deleteListDraft({ id: session.id, savedAt });
        if (result.error) return result;
      }
      autosave.stop();
      track("draft_deleted", { kind: "list", from: "editor" });
      session.onDeleted();
      return {};
    },
    // Waits for saving to finish, then gives the draft as last saved, which
    // creating the list deletes
    async toPublish(): Promise<{ id: string; savedAt: string } | null> {
      if (!session) return null;
      const savedAt = await autosave.settle();
      return savedAt ? { id: session.id, savedAt } : null;
    },
    // The list was created from the draft, so nothing more is saved
    published(draft: { id: string; savedAt: string } | null) {
      autosave.stop();
      if (draft) track("draft_published", { kind: "list" });
    },
  };
}

export type ListDraft = ReturnType<typeof useListDraft>;
