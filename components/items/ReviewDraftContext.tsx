// ABOUTME: The review being written on an item's page: the picture picked for it and its saved draft.
// ABOUTME: Shared by the item's big picture, where the picture is picked, and the log form, which saves it.
"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import type { LogDraft } from "@/lib/drafts";
import type { PictureChoice } from "@/lib/pictureChoices";

type ReviewDraft = {
  // Null until a picture is picked, and again once the entry is saved
  picked: PictureChoice | null;
  pick: (choice: PictureChoice | null) => void;
  // The saved draft the form starts from
  draft: LogDraft | null;
  // When this tab last saved the draft or saw it saved, or null with no draft
  savedAt: string | null;
  setSavedAt: (savedAt: string | null) => void;
  // Goes up when the page brings a draft saved somewhere else, so the form
  // starts over from it
  version: number;
};

const ReviewDraftContext = createContext<ReviewDraft>({
  picked: null,
  pick: () => {},
  draft: null,
  savedAt: null,
  setSavedAt: () => {},
  version: 0,
});

function draftPicture(draft: LogDraft | null): PictureChoice | null {
  return draft?.imageUrl
    ? { url: draft.imageUrl, filePage: draft.imageFilePage, isDefault: false }
    : null;
}

export function ReviewDraftProvider({
  draft,
  children,
}: {
  draft: LogDraft | null;
  children: ReactNode;
}) {
  const [picked, pick] = useState<PictureChoice | null>(() =>
    draftPicture(draft),
  );
  const [savedAt, setSavedAt] = useState<string | null>(draft?.savedAt ?? null);
  const [version, setVersion] = useState<number>(0);
  // The page stays mounted while hidden. When it comes back with a draft this
  // tab didn't save, or without the one it did, the form takes that instead.
  const pageSavedAt = draft?.savedAt ?? null;
  const [lastPageSavedAt, setLastPageSavedAt] = useState(pageSavedAt);
  if (pageSavedAt !== lastPageSavedAt) {
    setLastPageSavedAt(pageSavedAt);
    if (pageSavedAt !== savedAt) {
      setSavedAt(pageSavedAt);
      pick(draftPicture(draft));
      setVersion(version + 1);
    }
  }

  return (
    <ReviewDraftContext
      value={{ picked, pick, draft, savedAt, setSavedAt, version }}
    >
      {children}
    </ReviewDraftContext>
  );
}

export function useReviewDraft(): ReviewDraft {
  return useContext(ReviewDraftContext);
}
