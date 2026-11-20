// ABOUTME: The Save draft button and the line saying when the draft was last saved.
// ABOUTME: Shown beside a new list's Create list button.
"use client";

import { useTranslations } from "next-intl";
import AutosaveStatus from "@/components/drafts/AutosaveStatus";
import type { ListDraft } from "@/components/drafts/useListDraft";

export default function DraftControls({
  draft,
  disabled,
  onSave,
}: {
  draft: ListDraft;
  disabled: boolean;
  // Saves the draft, after anything that has to happen first
  onSave: () => void;
}) {
  const t = useTranslations();
  return (
    <>
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="rounded-lg border border-line px-6 py-2 hover:border-accent disabled:opacity-40"
      >
        {t("drafts.saveDraft")}
      </button>
      <AutosaveStatus state={draft.state} savedAt={draft.savedAt} />
    </>
  );
}
