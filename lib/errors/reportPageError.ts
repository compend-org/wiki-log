// ABOUTME: Sends an error caught by an error screen to Sentry.
// ABOUTME: Records which screen caught it and whether the browser was online and visible.
import * as Sentry from "@sentry/nextjs";

export function reportPageError(error: unknown, source: string) {
  Sentry.captureException(error, {
    tags: { error_source: source },
    contexts: {
      browser_state: {
        online: navigator.onLine,
        visibility_state: document.visibilityState,
      },
    },
  });
}
