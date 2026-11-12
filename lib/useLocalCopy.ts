// ABOUTME: A local copy of a saved value that the person changes, such as a form field or a toggle.
// ABOUTME: Keeps the local change until the saved value itself changes, then starts from the new one.
"use client";

import { useState } from "react";

// Pages stay mounted while hidden, so a local change survives leaving and
// coming back. When the server sends a different saved value, after a save
// here or elsewhere, the local copy is replaced by it.
export function useLocalCopy<T>(saved: T): [T, (copy: T) => void] {
  const [copy, setCopy] = useState<T>(saved);
  const [lastSaved, setLastSaved] = useState<T>(saved);
  if (saved !== lastSaved) {
    setLastSaved(saved);
    setCopy(saved);
  }
  return [copy, setCopy];
}
