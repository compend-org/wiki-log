// ABOUTME: Last-resort error screen, shown when the root layout itself fails.
// ABOUTME: Reports the error to Sentry and offers a way to try again.
"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { error_source: "global-error" },
      contexts: {
        browser_state: {
          online: navigator.onLine,
          visibility_state: document.visibilityState,
        },
      },
    });
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
