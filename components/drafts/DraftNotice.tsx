// ABOUTME: The line above a form that opened a saved draft, with a button that deletes the draft.
// ABOUTME: Shown on an item's log form and on the new-list page.
"use client";

import { useTranslations } from "next-intl";
import DeleteDraftButton from "@/components/drafts/DeleteDraftButton";

export default function DraftNotice({
  label,
  onDelete,
}: {
  label: string;
  // Deletes the draft; on success the form starts over
  onDelete: () => Promise<{ error?: string }>;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-l-2 border-accent pl-3 text-sm">
      <span className="font-semibold">{label}</span>
      <DeleteDraftButton onDelete={onDelete} className="text-danger underline">
        {t("drafts.deleteDraft")}
      </DeleteDraftButton>
    </div>
  );
}
