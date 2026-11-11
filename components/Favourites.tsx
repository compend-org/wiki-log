"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { removeFavourite, setFavourite } from "@/app/actions";
import ItemPicker from "@/components/ItemPicker";
import ItemImage from "@/components/icons/ItemImage";
import { track } from "@/lib/analytics";

export type Slot = { itemId: string; title: string; imageUrl: string | null };

export default function Favourites({
  slots,
  isOwner,
}: {
  slots: (Slot | null)[];
  isOwner: boolean;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [removing, setRemoving] = useState<boolean>(false);
  const router = useRouter();
  const hasFavourites = slots.some(Boolean);
  const showRemove = removing && hasFavourites;

  async function handlePick(itemId: string) {
    if (editing === null) return;
    setBusy(true);
    setError("");
    const result = await setFavourite({ position: editing, itemId });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    track("favourite_set", { position: editing });
    setEditing(null);
    router.refresh();
  }

  async function handleRemove(position: number) {
    setBusy(true);
    setError("");
    let result: { error?: string };
    try {
      result = await removeFavourite(position);
    } catch {
      // The request can fail outright, e.g. when it races a page change
      result = { error: "Couldn't remove it. Reload the page to try again." };
    }
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    track("favourite_removed", { position });
    router.refresh();
  }

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Top 5
        </h2>
        {isOwner && hasFavourites && (
          <button
            type="button"
            onClick={() => {
              setRemoving((r) => !r);
              setError("");
            }}
            className="text-sm text-muted hover:text-accent"
          >
            {showRemove ? "Done" : "Edit"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-5 gap-2">
        {slots.map((slot, i) => {
          const position = i + 1;

          if (slot) {
            return (
              <div key={position} className="relative min-w-0">
                {/* While removing, the image isn't a link, so a missed tap
                    can't navigate away mid-request */}
                {showRemove ? (
                  <ItemImage
                    src={slot.imageUrl}
                    alt={slot.title}
                    className="aspect-square w-full rounded"
                  />
                ) : (
                  <Link
                    href={`/item/${slot.itemId}`}
                    title={slot.title}
                    className="block transition-transform hover:-translate-y-0.5"
                  >
                    <ItemImage
                      src={slot.imageUrl}
                      alt={slot.title}
                      className="aspect-square w-full rounded"
                    />
                  </Link>
                )}

                {showRemove && (
                  <button
                    type="button"
                    onClick={() => handleRemove(position)}
                    disabled={busy}
                    aria-label={`Remove ${slot.title}`}
                    className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-background text-sm text-foreground shadow disabled:opacity-40"
                  >
                    ×
                  </button>
                )}
                <span className="block truncate text-xs" title={slot.title}>
                  {slot.title}
                </span>
              </div>
            );
          }

          return isOwner ? (
            <button
              key={position}
              type="button"
              onClick={() => {
                setEditing(position);
                setError("");
              }}
              aria-label={`Add an item to slot ${position}`}
              className={`flex aspect-square items-center justify-center rounded-lg border-2 border-dashed text-xl transition-colors hover:border-accent hover:text-accent ${
                editing === position
                  ? "border-accent text-accent"
                  : "border-line text-muted"
              }`}
            >
              +
            </button>
          ) : (
            <div
              key={position}
              className="aspect-square rounded-lg border-2 border-dashed border-line"
            />
          );
        })}
      </div>

      {isOwner && editing !== null && (
        <div className="mt-3 flex flex-col gap-2">
          <ItemPicker
            onPick={handlePick}
            placeholder={`Search for slot ${editing}…`}
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setError("");
            }}
            className="self-start rounded-lg border border-line px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}
