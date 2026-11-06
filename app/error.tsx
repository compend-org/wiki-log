// ABOUTME: Error screen for a page that fails, shown inside the site's layout.
// ABOUTME: Reports the error to Sentry and offers a way to try again.
"use client";

import { useEffect } from "react";
import { isConnectionError } from "@/lib/connectionError";
import { reportPageError } from "@/lib/reportPageError";

export default function PageError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    reportPageError(error, "page-error");
  }, [error]);

  return (
    <main className="p-8">
      <h2>
        {isConnectionError(error)
          ? "The page didn't finish loading. Check your connection and try again."
          : "Something went wrong."}
      </h2>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-4 bg-accent px-4 py-2 text-background"
      >
        Try again
      </button>
    </main>
  );
}
