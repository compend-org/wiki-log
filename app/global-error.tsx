// ABOUTME: Last-resort error screen, shown when the root layout itself fails.
// ABOUTME: Reports the error to Sentry and offers a way to try again.
"use client";

import { useEffect } from "react";
import { reportPageError } from "@/lib/reportPageError";

export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    reportPageError(error, "global-error");
  }, [error]);

  return (
    <html lang="en">
      <body>
        <h2>Something went wrong.</h2>
        <button type="button" onClick={() => retry()}>
          Try again
        </button>
      </body>
    </html>
  );
}
