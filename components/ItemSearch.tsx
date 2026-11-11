"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import ItemPicker from "@/components/ItemPicker";
import { loginHref } from "@/lib/redirect";
import { useRandomItem } from "@/lib/useRandomItem";

export default function ItemSearch({
  signedIn,
  headingAction,
}: {
  signedIn: boolean;
  // Shown at the right end of the heading's row
  headingAction?: ReactNode;
}) {
  const router = useRouter();
  const { goRandom, busy, error } = useRandomItem();

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
          disabled={busy}
          className="text-accent underline hover:no-underline disabled:opacity-60"
        >
          {busy ? "finding one…" : "go random"}
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
