"use client";

// ABOUTME: The ⋯ menu on a card about an item, with the choice to hide that item.
// ABOUTME: Hiding takes the item's cards off the page; only the viewer knows.

import { useTranslations } from "next-intl";
import { useState } from "react";
import HideIcon from "@/components/ui/HideIcon";
import { setItemHidden } from "@/lib/hooks/useHidingChange";

export default function HideItemMenu({
  viewerId,
  itemId,
  title,
  cardKey,
}: {
  viewerId: string;
  itemId: string;
  title: string;
  // The card the menu is on, which then says the item is hidden
  cardKey: string;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  async function hide() {
    if (busy) return;
    setBusy(true);
    setError("");
    const message = await setItemHidden(viewerId, itemId, true, cardKey);
    setBusy(false);
    if (message) setError(message);
    else setOpen(false);
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: closes the menu on events from the controls inside it
    <div
      className="relative flex"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={t("hiding.more")}
        className={`flex h-7 w-7 items-center justify-center border ${
          open
            ? "border-line bg-surface text-foreground"
            : "border-transparent text-muted hover:text-foreground"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className="h-5 w-5"
        >
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[16] mt-1 flex w-max max-w-[16rem] flex-col border border-line bg-background p-1 text-sm">
          <button
            type="button"
            onClick={hide}
            disabled={busy}
            className="flex items-start gap-2.5 px-2.5 py-2 text-left hover:bg-surface disabled:opacity-40"
          >
            <HideIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="[overflow-wrap:anywhere]">
                {t.rich("hiding.hide", {
                  title,
                  b: (c) => <b className="font-semibold">{c}</b>,
                })}
              </span>
              <span className="text-xs text-muted">{t("hiding.hideNote")}</span>
            </span>
          </button>
          {error && (
            <span role="alert" className="px-2.5 pb-1 text-xs text-danger">
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
