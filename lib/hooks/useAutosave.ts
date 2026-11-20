// ABOUTME: Saves a form's draft a moment after each change, when the page is hidden or left, and on request.
// ABOUTME: Saves run one at a time, each naming the version it replaces, and stop once one is refused.
"use client";

import { useEffect, useRef, useState } from "react";
import type { DraftSaveResult } from "@/lib/drafts";

// How long after the last change a draft is saved
const PAUSE_MS = 2000;

export type AutosaveState =
  | "idle"
  | "saving"
  | "saved"
  // The last save failed; the next change tries again
  | "failed"
  // The draft was changed or deleted elsewhere, so saving has stopped
  | "conflict";

type Options<T> = {
  // What the form holds now
  value: T;
  // When the draft was last saved, or null if there is none yet
  savedAt: string | null;
  // Stores `value` in place of the draft saved at `savedAt`
  save: (value: T, savedAt: string | null) => Promise<DraftSaveResult>;
  onSaved: (savedAt: string) => void;
  // Whether the form holds enough to start a draft. Once there is one, every
  // change is saved, including clearing things out.
  worthStarting: boolean;
  // While true, changes wait to be saved
  paused?: boolean;
};

export function useAutosave<T>(options: Options<T>) {
  const { value, savedAt, worthStarting, paused = false } = options;
  const json = JSON.stringify(value);
  const [state, setState] = useState<AutosaveState>("idle");

  // The latest options, for saves that run after this render
  const latest = useRef(options);
  // The form as last saved; the form as it first showed counts as saved
  const lastSaved = useRef(json);
  // When the draft was last saved, ahead of the prop, which follows a render
  const savedVersion = useRef(savedAt);
  const running = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    latest.current = options;
    savedVersion.current = options.savedAt;
  });

  // Saves the form if it changed since it was last saved. `asked` saves even
  // a form not worth starting a draft for, as the Save draft button does.
  async function run(asked: boolean): Promise<boolean> {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    while (running.current) await running.current;
    if (stopped.current) return false;

    const { value, save, onSaved, worthStarting, paused } = latest.current;
    const snapshot = JSON.stringify(value);
    const version = savedVersion.current;
    if (snapshot === lastSaved.current && version !== null) return true;
    if (!asked && (paused || (version === null && !worthStarting))) {
      return false;
    }

    setState("saving");
    const attempt = save(value, version)
      .then((result) => {
        if ("savedAt" in result) {
          lastSaved.current = snapshot;
          savedVersion.current = result.savedAt;
          onSaved(result.savedAt);
          setState("saved");
          return true;
        }
        if ("conflict" in result) {
          stopped.current = true;
          setState("conflict");
          return false;
        }
        setState("failed");
        return false;
      })
      .catch(() => {
        setState("failed");
        return false;
      })
      .finally(() => {
        running.current = null;
      });
    running.current = attempt;
    return attempt;
  }

  // A moment after each change
  // biome-ignore lint/correctness/useExhaustiveDependencies: `run` reads the latest options itself
  useEffect(() => {
    if (stopped.current || paused || json === lastSaved.current) return;
    if (savedVersion.current === null && !worthStarting) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(false), PAUSE_MS);
  }, [json, worthStarting, paused]);

  // At once when the tab is hidden or closed, and when this form is hidden or
  // removed, as leaving its page by a link does
  // biome-ignore lint/correctness/useExhaustiveDependencies: `run` reads the latest options itself
  useEffect(() => {
    const whenHidden = () => {
      if (document.visibilityState === "hidden") run(false);
    };
    const whenClosed = () => run(false);
    document.addEventListener("visibilitychange", whenHidden);
    window.addEventListener("pagehide", whenClosed);
    return () => {
      document.removeEventListener("visibilitychange", whenHidden);
      window.removeEventListener("pagehide", whenClosed);
      run(false);
    };
  }, []);

  return {
    state,
    // Saves now, as the Save draft button asks. True once the form is saved.
    saveNow: () => run(true),
    // Waits for any save under way and cancels the one waiting to start.
    // Returns when the draft was last saved, for publishing it.
    async settle(): Promise<string | null> {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      while (running.current) await running.current;
      return savedVersion.current;
    },
    // The draft is gone and the form holds `emptied`, which isn't saved
    // until it changes. Saving stops altogether when the form is done with.
    forget(emptied: T) {
      lastSaved.current = JSON.stringify(emptied);
      savedVersion.current = null;
      setState("idle");
    },
    stop() {
      stopped.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    },
  };
}
