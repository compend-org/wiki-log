// ABOUTME: Error screen for a page that fails, shown inside the site's layout.
// ABOUTME: Reports the error to Sentry and offers a way to try again.
"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { isConnectionError } from "@/lib/errors/connectionError";
import { reportPageError } from "@/lib/errors/reportPageError";

export default function PageError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const t = useTranslations();
  useEffect(() => {
    reportPageError(error, "page-error");
  }, [error]);

  return (
    <main className="p-8">
      <h2>
        {isConnectionError(error)
          ? t("errors.connection")
          : t("common.somethingWentWrong")}
      </h2>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-4 bg-accent px-4 py-2 text-background"
      >
        {t("common.tryAgain")}
      </button>
    </main>
  );
}
