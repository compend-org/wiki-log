"use client";

// ABOUTME: A card about an item, which goes away once the viewer hides that item.
// ABOUTME: The card it was hidden from says so instead, with a way to take it back.

import Link from "next/link";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import HideIcon from "@/components/ui/HideIcon";
import { setItemHidden, useHidingChange } from "@/lib/hooks/useHidingChange";

export default function HideableCard({
  viewerId,
  itemId,
  title,
  cardKey,
  children,
}: {
  viewerId: string;
  itemId: string;
  title: string;
  // Tells this card apart from other cards about the same item
  cardKey: string;
  children: ReactNode;
}) {
  const t = useTranslations();
  const change = useHidingChange(viewerId, itemId);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  if (!change?.hidden) return children;
  if (change.fromCard !== cardKey) return null;

  async function undo() {
    setBusy(true);
    setError(await setItemHidden(viewerId, itemId, false));
    setBusy(false);
  }

  return (
    <div className="card flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-3 text-sm text-muted">
      <span className="flex items-center gap-2">
        <HideIcon className="h-4 w-4 shrink-0" />
        <span className="[overflow-wrap:anywhere]">
          {t.rich("hiding.hiddenHere", {
            title,
            b: (c) => <b className="font-semibold text-foreground">{c}</b>,
          })}
        </span>
      </span>
      <span className="flex items-center gap-4">
        <button
          type="button"
          onClick={undo}
          disabled={busy}
          className="text-foreground underline disabled:opacity-40"
        >
          {t("hiding.undo")}
        </button>
        <Link href="/settings#hidden-items" className="underline">
          {t("hiding.manage")}
        </Link>
      </span>
      {error && (
        <span role="alert" className="basis-full text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
