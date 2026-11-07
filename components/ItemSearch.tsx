"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import ItemPicker from "@/components/ItemPicker";
import { DEFAULT_LANG, isLang } from "@/lib/languages";
import { loginHref } from "@/lib/redirect";

export default function ItemSearch({
  signedIn,
  headingAction,
}: {
  signedIn: boolean;
  // Shown at the right end of the heading's row
  headingAction?: ReactNode;
}) {
  const router = useRouter();
  const [randoming, setRandoming] = useState<boolean>(false);
  const [navigating, startTransition] = useTransition();
  const [error, setError] = useState<string>("");

  // A random article, from the Wikipedia in the language chosen in the search
  async function goRandom() {
    if (randoming || navigating) return;
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
      startTransition(() => router.push(`/item/${data.id}`));
      setRandoming(false);
    } catch {
      setError("Couldn't reach the server.");
      setRandoming(false);
    }
  }

  // Signed-out visitors sign in first, then land on the list creator
  const newListHref = signedIn ? "/list/new" : loginHref("/list/new");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Log.</h1>
        {headingAction}
      </div>
      <p className="text-sm text-muted">
        Search, paste a Wikipedia article URL, or{" "}
        <button
          type="button"
          onClick={goRandom}
          disabled={randoming || navigating}
          className="text-accent underline hover:no-underline disabled:opacity-60"
        >
          {randoming || navigating ? "finding one…" : "go random"}
        </button>
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <ItemPicker onPick={(id) => router.push(`/item/${id}`)} />
      <p className="text-right text-sm text-muted">
        or{" "}
        <Link
          href={newListHref}
          className="text-accent underline hover:no-underline"
        >
          make a list
        </Link>
      </p>
    </section>
  );
}
