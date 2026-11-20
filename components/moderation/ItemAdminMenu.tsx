"use client";

// ABOUTME: An admin's dropdown on an item page, with a switch that marks the item NSFW or safe.
// ABOUTME: Saves on each flip; refreshes from Wikipedia keep what an admin chose.
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { setItemNsfw } from "@/app/actions";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";

export default function ItemAdminMenu({
  itemId,
  nsfw,
  setBy,
  setDate,
}: {
  itemId: string;
  nsfw: boolean;
  // Who last set the flag by hand, if an admin did and their account remains
  setBy: string | null;
  // When an admin last set the flag by hand, as shown on the page
  setDate: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState<boolean>(false);
  const [on, setOn] = useLocalCopy(nsfw);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  async function flip() {
    if (busy) return;
    const next = !on;
    setOn(next);
    setBusy(true);
    setError("");
    try {
      const result = await setItemNsfw(itemId, next);
      if (result.error) {
        setOn(!next);
        setError(result.error);
      } else {
        router.refresh();
      }
    } catch {
      setOn(!next);
      setError(t("errors.save"));
    } finally {
      setBusy(false);
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: closes the menu on events from the controls inside it
    <div
      className="relative flex shrink-0 pt-1.5"
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
        aria-label={t("moderation.adminTools")}
        className="flex items-center gap-2 border border-line bg-surface px-2 py-1.5 hover:border-accent"
      >
        <span className="text-[0.65rem] font-semibold uppercase leading-none tracking-wider text-[#1b7f3b] [[data-theme=dark]_&]:text-[#5fd08a]">
          {t("moderation.admin")}
        </span>
        <span aria-hidden="true" className="text-xs text-muted">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[16] mt-1 flex w-max flex-col gap-1.5 border border-line bg-background p-3">
          <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={flip}
            className="flex items-center gap-3 text-sm"
          >
            <span
              aria-hidden="true"
              className={`relative h-5 w-9 border ${
                on ? "border-accent bg-accent" : "border-line bg-surface"
              }`}
            >
              <span
                className={`absolute top-px h-4 w-4 border border-line bg-background ${
                  on ? "right-px" : "left-px"
                }`}
              />
            </span>
            NSFW
          </button>
          {setDate && (
            <span className="text-xs text-muted">
              {t("moderation.nsfwSetBy", {
                hasName: setBy ? "yes" : "no",
                name: setBy ?? "",
                date: setDate,
              })}
            </span>
          )}
          {error && (
            <span role="alert" className="text-xs text-danger">
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
