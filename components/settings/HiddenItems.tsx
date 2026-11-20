// ABOUTME: Lists the items the signed-in person has hidden, on the settings page,
// ABOUTME: with a button to show each one again.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setItemHidden } from "@/lib/hooks/useHidingChange";

export type HiddenItem = { id: string; title: string };

export default function HiddenItems({
  viewerId,
  items,
}: {
  viewerId: string;
  items: HiddenItem[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = useState<boolean>(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string>("");

  async function show(item: HiddenItem) {
    setBusy(true);
    setError("");
    const message = await setItemHidden(viewerId, item.id, false);
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    // Brings the shorter list back from the server
    startRefresh(() => router.refresh());
  }

  return (
    <section id="hidden-items" className="flex scroll-mt-4 flex-col gap-2">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
        {t("hiding.title")}
      </h2>
      {items.length === 0 && (
        <p className="text-sm text-muted">{t("hiding.none")}</p>
      )}
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-3">
          <Link
            href={`/item/${item.id}`}
            className="min-w-0 text-sm underline [overflow-wrap:anywhere]"
          >
            {item.title}
          </Link>
          <button
            type="button"
            onClick={() => show(item)}
            disabled={busy || refreshing}
            className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm disabled:opacity-40"
          >
            {t("hiding.showItem")}
          </button>
        </div>
      ))}
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
