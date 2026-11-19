// ABOUTME: Tells the author of a removed review or list that the moderators removed it.
// ABOUTME: Only authors ever see removed posts, so this is always addressed to them.

import { useTranslations } from "next-intl";

export default function RemovedNotice({ noun }: { noun: string }) {
  const t = useTranslations();
  return (
    <p
      role="status"
      className="rounded-lg border border-danger px-4 py-3 text-sm text-danger"
    >
      {t("logs.removedNotice", { noun })}
    </p>
  );
}
