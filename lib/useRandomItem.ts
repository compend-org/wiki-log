"use client";

// ABOUTME: Opens a random article from the Wikipedia in the search's language.
// ABOUTME: The article page is told it came from a roll, so it can offer another.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DEFAULT_LANG, isLang } from "@/lib/languages";
import { RANDOM_PARAM } from "@/lib/randomItem";

export function useRandomItem(): {
  goRandom: () => Promise<void>;
  busy: boolean;
  error: string;
} {
  const router = useRouter();
  const [randoming, setRandoming] = useState<boolean>(false);
  const [navigating, startTransition] = useTransition();
  const [error, setError] = useState<string>("");
  const busy = randoming || navigating;

  async function goRandom() {
    if (busy) return;
    setRandoming(true);
    setError("");
    let lang: string = DEFAULT_LANG;
    try {
      const stored = localStorage.getItem("search-lang");
      if (stored && isLang(stored)) lang = stored;
    } catch {
      // Storage can be blocked; the default language is fine
    }
    try {
      const res = await fetch(`/api/random?lang=${lang}`);
      const data: { id?: string; error?: string } = await res.json();
      if (!res.ok || !data.id) {
        setError(data.error ?? "Couldn't find a random page.");
        setRandoming(false);
        return;
      }
      startTransition(() => router.push(`/item/${data.id}?${RANDOM_PARAM}=1`));
      setRandoming(false);
    } catch {
      setError("Couldn't reach the server.");
      setRandoming(false);
    }
  }

  return { goRandom, busy, error };
}
