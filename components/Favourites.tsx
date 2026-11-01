"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setFavourite, removeFavourite } from "@/app/actions";
import { getVideoId } from "@/lib/youtube";
import { USE_STUB } from "@/lib/video";

export type Slot = { videoId: string; title: string };

export default function Favourites({
    slots,
    isOwner,
}: {
    slots: (Slot | null)[];
    isOwner: boolean;
}) {
    const [editing, setEditing] = useState<number | null>(null);
    const [link, setLink] = useState<string>("");
    const [error, setError] = useState<string>("");
    const [busy, setBusy] = useState<boolean>(false);
    const router = useRouter();

    async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (editing === null) return;

        const id = getVideoId(link);
        if (!id) {
            setError("That doesn't look like a YouTube link.");
            return;
        }

        setBusy(true);
        setError("");
        const result = await setFavourite({ position: editing, videoId: id });
        setBusy(false);
        if (result.error) {
            setError(result.error);
            return;
        }
        setEditing(null);
        setLink("");
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
                                    href={`/video/${slot.videoId}`}
                                    title={slot.title}
                                    className="block transition-transform hover:-translate-y-0.5"
                                >
                                    {USE_STUB ? (
                                        <div className="flex aspect-video items-center justify-center rounded bg-surface p-1 text-center text-[10px] leading-tight bg-surface text-foreground">
                                            {slot.title}
                                        </div>
                                    ) : (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={`https://i.ytimg.com/vi/${slot.videoId}/mqdefault.jpg`}
                                            alt={slot.title}
                                            className="aspect-video w-full rounded object-cover"
                                        />
                                    )}
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
                            </div>
                        );
                    }

                    return isOwner ? (
                        <button
                            key={position}
                            type="button"
                            onClick={() => {
                                setEditing(position);
                                setLink("");
                                setError("");
                            }}
                            aria-label={`Add a video to slot ${position}`}
                            className={`flex aspect-video items-center justify-center rounded-lg border-2 border-dashed text-xl transition-colors hover:border-accent hover:text-accent ${editing === position
                                    ? "border-accent text-accent"
                                    : "border-line text-muted"
                                }`}
                        >
                            +
                        </button>
                    ) : (
                        <div
                            key={position}
                            className="aspect-video rounded border-2 border-dashed border-line"
                        />
                    );
                })}
            </div>

            {isOwner && editing !== null && (
                <form onSubmit={handleAdd} className="mt-3 flex gap-2">
                    <input
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        placeholder={`Paste a YouTube link for slot ${editing}`}
                        autoFocus
                        className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 bg-surface text-foreground"
                    />
                    <button
                        type="submit"
                        disabled={busy}
                        className="rounded-lg bg-accent px-3 py-2 text-background disabled:opacity-40"
                    >
                        {busy ? "Adding…" : "Add"}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setEditing(null);
                            setError("");
                        }}
                        className="rounded-lg border border-line px-3 py-2"
                    >
                        Cancel
                    </button>
                </form>
            )}

            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </section>
    );
}