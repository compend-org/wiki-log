"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setFavourite, removeFavourite } from "@/app/actions";
import ItemPicker from "@/components/ItemPicker";
import ItemImage from "@/components/ItemImage";

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
    const router = useRouter();

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
        setEditing(null);
        router.refresh();
    }

    async function handleRemove(position: number) {
        setBusy(true);
        setError("");
        const result = await removeFavourite(position);
        setBusy(false);
        if (result.error) {
            setError(result.error);
            return;
        }
        router.refresh();
    }

    return (
        <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
                Top 5
            </h2>

            <div className="grid grid-cols-5 gap-2">
                {slots.map((slot, i) => {
                    const position = i + 1;

                    if (slot) {
                        return (
                            <div key={position} className="relative">
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

                                {isOwner && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemove(position)}
                                        disabled={busy}
                                        aria-label={`Remove ${slot.title}`}
                                        className="absolute right-0.5 top-0.5 rounded bg-background/80 px-1.5 text-xs text-foreground"
                                    >
                                        ×
                                    </button>
                                )}
                                <span className="truncate text-xs">{slot.title}</span>
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
                            className={`flex aspect-square items-center justify-center rounded-lg border-2 border-dashed text-xl transition-colors hover:border-accent hover:text-accent ${editing === position
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