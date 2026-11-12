// ABOUTME: An editable copy of a saved value, for a form field the person is typing in.
// ABOUTME: Keeps the typing until the saved value itself changes, then starts from the new one.
"use client";

import { useState } from "react";

// Pages stay mounted while hidden, so typing survives leaving and coming back.
// When the server sends a different saved value, after a save here or
// elsewhere, the draft is replaced by it.
export function useDraft<T>(saved: T): [T, (draft: T) => void] {
  const [draft, setDraft] = useState<T>(saved);
  const [lastSaved, setLastSaved] = useState<T>(saved);
  if (saved !== lastSaved) {
    setLastSaved(saved);
    setDraft(saved);
  }
  return [draft, setDraft];
}
