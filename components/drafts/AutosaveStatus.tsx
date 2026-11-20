// ABOUTME: Says whether a draft is saving, when it was last saved, or why it isn't being saved.
// ABOUTME: The time is in the visitor's own time zone, so it shows once the page runs in the browser.
"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import type { AutosaveState } from "@/lib/hooks/useAutosave";

const neverChanges = () => () => {};

export default function AutosaveStatus({
  state,
  savedAt,
}: {
  state: AutosaveState;
  savedAt: string | null;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const inBrowser = useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );

  if (state === "saving") {
    return <span className="text-sm text-muted">{t("common.saving")}</span>;
  }
  if (state === "failed") {
    return (
      <span role="status" className="text-sm text-danger">
        {t("drafts.autosaveFailed")}
      </span>
    );
  }
  if (state === "conflict") {
    return (
      <span role="status" className="text-sm text-danger">
        {t("drafts.changedElsewhere")}
      </span>
    );
  }
  if (!savedAt || !inBrowser) return null;
  // The time alone today, and the day too before that
  const date = new Date(savedAt);
  const time = date.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <span role="status" className="text-sm text-muted">
      {date.toDateString() === new Date().toDateString()
        ? t("drafts.autosavedAt", { time })
        : t("drafts.autosavedOn", {
            time,
            date: date.toLocaleDateString(locale, {
              month: "short",
              day: "numeric",
            }),
          })}
    </span>
  );
}
