// ABOUTME: A line on the owner's own list, while it has no notes, suggesting they write some.
// ABOUTME: Dismissing it hides it on all their lists for good.
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ListNotesHint({
  userId,
  editHref,
}: {
  userId: string;
  editHref: string;
}) {
  const t = useTranslations();
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  async function dismiss() {
    setDismissed(true);
    // If this doesn't save, the hint is only back on the next visit
    await createClient()
      .from("user_settings")
      .upsert({ user_id: userId, list_notes_hint_dismissed: true });
  }

  return (
    <p className="mt-1 text-sm text-muted">
      {t("lists.notes.hint")}{" "}
      <Link href={editHref} className="text-accent underline">
        {t("lists.notes.addNotes")}
      </Link>{" "}
      ·{" "}
      <button type="button" onClick={dismiss} className="underline">
        {t("lists.notes.dismiss")}
      </button>
    </p>
  );
}
