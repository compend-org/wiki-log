"use client";

import { useEffect, useId, useState } from "react";

type Hit = {
    key: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
};

export default function ItemPicker({
    onPick,
    placeholder = "Search Wikipedia titles…",
    autoFocus = false,
}: {
    onPick: (itemId: string) => void | Promise<void>;
    placeholder?: string;
    autoFocus?: boolean;
}) {
    const [query, setQuery] = useState<string>("");
    const [hits, setHits] = useState<Hit[]>([]);
    const [hitsFor, setHitsFor] = useState<string>("");
    const [open, setOpen] = useState<boolean>(false);
    const [active, setActive] = useState<number>(-1);
    const [busy, setBusy] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const listId = useId();

    const term = query.trim();
    const listOpen = open && term.length >= 2;
    const ready = hitsFor === term;

    useEffect(() => {
        if (term.length < 2) return;

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
                    signal: controller.signal,
                });
                if (!res.ok) return;
                const data: { results: Hit[] } = await res.json();
                setHits(data.results);
                setHitsFor(term);
                setActive(-1);
            } catch {
                // Cancelled by a newer keystroke, or the network failed
            }
        }, 300);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [term]);

    async function choose(hit: Hit) {
        setBusy(true);
        setError("");
        try {
            const res = await fetch(`/api/resolve?key=${encodeURIComponent(hit.key)}`);
            const data: { id?: string; error?: string } = await res.json();
            if (!res.ok || !data.id) {
                setError(data.error ?? "Something went wrong.");
                setBusy(false);
                return;
            }
            await onPick(data.id);
            setOpen(false);
        } catch {
            setError("Couldn't reach the server.");
        }
        setBusy(false);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, hits.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            if (listOpen && ready && hits.length > 0 && !busy) {
                e.preventDefault();
                choose(hits[active >= 0 ? active : 0]);
            }
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <div
                className="relative"
                onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                        setOpen(false);
                    }
                }}
            >
                <input
                    type="text"
                    role="combobox"
                    aria-expanded={listOpen}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                    autoComplete="off"
                    autoFocus={autoFocus}
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                        setError("");
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-line bg-surface px-4 py-2 text-foreground"
                />

                {listOpen && (
                    <ul
                        id={listId}
                        role="listbox"
                        // Keeps focus in the input while you click an option
                        onMouseDown={(e) => e.preventDefault()}
                        className="absolute z-[15] mt-1 max-h-96 w-full overflow-auto rounded-lg border border-line bg-background "
                    >
                        {!ready && (
                            <li className="px-4 py-3 text-sm text-muted">Searching…</li>
                        )}
                        {ready && hits.length === 0 && (
                            <li className="px-4 py-3 text-sm text-muted">No results.</li>
                        )}
                        {ready &&
                            hits.map((hit, i) => (
                                <li
                                    key={hit.key}
                                    id={`${listId}-${i}`}
                                    role="option"
                                    aria-selected={i === active}
                                >
                                    <button
                                        type="button"
                                        onClick={() => choose(hit)}
                                        onMouseEnter={() => setActive(i)}
                                        disabled={busy}
                                        className={`flex w-full items-center gap-3 px-3 py-2 text-left disabled:opacity-60 ${i === active ? "bg-surface" : ""
                                            }`}
                                    >
                                        {hit.imageUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={hit.imageUrl}
                                                alt=""
                                                className="h-10 w-10 shrink-0 rounded object-cover"
                                            />
                                        ) : (
                                            <div className="h-10 w-10 shrink-0 rounded bg-line/50" />
                                        )}
                                        <span className="flex min-w-0 flex-col">
                                            <span className="truncate font-semibold">{hit.title}</span>
                                            {hit.description && (
                                                <span className="truncate text-xs text-muted">
                                                    {hit.description}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                </li>
                            ))}
                    </ul>
                )}
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}
        </div>
    );
}