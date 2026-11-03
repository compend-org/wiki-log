"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import ItemImage from "@/components/ItemImage";

type Thumb = { title: string; image_url: string | null };
type Tip = { text: string; x: number; y: number };

// useLayoutEffect only produces a warning when rendered on the server
const useIsoLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function ListPreview({
    thumbs,
    total,
    href,
}: {
    thumbs: Thumb[];
    total: number;
    // Where a click on a thumbnail goes: the list it belongs to
    href: string;
}) {
    const row = useRef<HTMLDivElement>(null);
    // How many tiles fit on one line, or null until measured
    const [fit, setFit] = useState<number | null>(null);
    const [tip, setTip] = useState<Tip | null>(null);

    useIsoLayoutEffect(() => {
        const el = row.current;
        if (!el) return;

        function measure() {
            const container = row.current;
            const first = container?.firstElementChild as HTMLElement | null;
            if (!container || !first) return;

            const tile = first.getBoundingClientRect().width;
            const width = container.clientWidth;
            // Copies hidden with display: none measure as zero, so leave them alone
            if (tile === 0 || width === 0) return;

            const gap = parseFloat(getComputedStyle(container).columnGap) || 0;
            setFit(
                Math.max(1, Math.floor((width + gap) / (tile + gap) + 0.01))
            );
        }

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // The tooltip is positioned against the window, so it hides on scroll
    useEffect(() => {
        if (!tip) return;
        const hide = () => setTip(null);
        window.addEventListener("scroll", hide, true);
        return () => window.removeEventListener("scroll", hide, true);
    }, [tip]);

    function show(el: HTMLElement, text: string) {
        const r = el.getBoundingClientRect();
        // Keep the box inside the window (it is at most 16rem, about 256px, wide)
        const x = Math.min(
            Math.max(r.left + r.width / 2, 136),
            window.innerWidth - 136
        );
        setTip({ text, x, y: r.bottom });
    }
    const hide = () => setTip(null);

    // Show every item if they all fit. Otherwise give up the last slot for "+N".
    const room = fit ?? thumbs.length;
    let visible = thumbs.slice(0, room);
    let remaining = total - visible.length;
    if (remaining > 0) {
        visible = thumbs.slice(0, Math.max(0, room - 1));
        remaining = total - visible.length;
    }

    // Each tile sits above the card's overlay link (relative z-10), so it can
    // show its own tooltip, and it leads to the same list when clicked
    const tile = "relative z-10 flex h-14 w-14 shrink-0";

    return (
        <>
            <div ref={row} className="flex h-14 flex-wrap gap-1 overflow-hidden">
                {visible.map((p, i) => (
                    <Link
                        key={i}
                        href={href}
                        aria-label={p.title}
                        className={tile}
                        onMouseEnter={(e) => show(e.currentTarget, p.title)}
                        onMouseLeave={hide}
                        onFocus={(e) => show(e.currentTarget, p.title)}
                        onBlur={hide}
                    >
                        <ItemImage
                            src={p.image_url}
                            alt=""
                            className="h-14 w-14 rounded"
                        />
                    </Link>
                ))}
                {remaining > 0 && (
                    <Link
                        href={href}
                        className={`${tile} items-center justify-center border border-line bg-surface text-sm font-semibold text-muted no-underline`}
                        onMouseEnter={(e) =>
                            show(
                                e.currentTarget,
                                `${remaining} more ${remaining === 1 ? "item" : "items"}`
                            )
                        }
                        onMouseLeave={hide}
                        onFocus={(e) =>
                            show(
                                e.currentTarget,
                                `${remaining} more ${remaining === 1 ? "item" : "items"}`
                            )
                        }
                        onBlur={hide}
                    >
                        +{remaining}
                    </Link>
                )}
            </div>

            {tip && (
                <div
                    role="tooltip"
                    style={{ left: tip.x, top: tip.y + 8 }}
                    className="card pointer-events-none fixed z-50 max-w-[16rem] -translate-x-1/2 px-2 py-1 text-xs"
                >
                    {tip.text}
                </div>
            )}
        </>
    );
}