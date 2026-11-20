"use client";

// ABOUTME: Hides an item from its page, or shows it again, for the signed-in person.
// ABOUTME: Once hidden, a note says what that does; the page itself still shows the item.

import { useTranslations } from "next-intl";
import { useState } from "react";
import HideIcon from "@/components/ui/HideIcon";
import { setItemHidden, useHidingChange } from "@/lib/hooks/useHidingChange";

export default function HideItemButton({
  viewerId,
  itemId,
  hidden,
}: {
  viewerId: string;
  itemId: string;
  hidden: boolean;
}) {
  const t = useTranslations();
  // A change made since the page loaded, here or elsewhere, wins over the
  // server's answer
  const shownHidden = useHidingChange(viewerId, itemId)?.hidden ?? hidden;
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError("");
    setError(await setItemHidden(viewerId, itemId, !shownHidden));
    setBusy(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm text-muted enabled:hover:border-accent enabled:hover:text-foreground disabled:opacity-40"
      >
        {!shownHidden && <HideIcon className="h-4 w-4" />}
        {shownHidden ? t("hiding.showItem") : t("hiding.hideItem")}
      </button>
      {shownHidden && (
        <p className="flex basis-full items-start gap-2 text-sm text-muted">
          <HideIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {t("hiding.itemNote")}
        </p>
      )}
      {error && (
        <p role="alert" className="basis-full text-sm text-danger">
          {error}
        </p>
      )}
    </>
  );
}
