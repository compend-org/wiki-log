// ABOUTME: Stops Sentry sending the same error over and over from one browser tab or server instance.
// ABOUTME: A few of each get through every hour, so one broken request can't use up the month's quota.
import type { ErrorEvent } from "@sentry/nextjs";

const MAX_PER_WINDOW = 3;
const WINDOW_MS = 60 * 60 * 1000;
// Errors whose messages hold ids would otherwise grow the list without end
const MAX_KEYS = 500;

// Two events are the same error when they share a fingerprint, or failing
// that, the error's type and message
function errorKey(event: ErrorEvent): string {
  if (event.fingerprint?.length) return event.fingerprint.join("|");
  const error = event.exception?.values?.[0];
  return error ? `${error.type}: ${error.value}` : (event.message ?? "");
}

// A beforeSend that drops an error once it has been sent MAX_PER_WINDOW
// times within the hour
export function limitRepeatedErrors(now: () => number = Date.now) {
  const seen = new Map<string, { since: number; count: number }>();
  return (event: ErrorEvent): ErrorEvent | null => {
    const key = errorKey(event);
    const time = now();
    const entry = seen.get(key);
    if (!entry || time - entry.since >= WINDOW_MS) {
      if (seen.size >= MAX_KEYS) seen.clear();
      seen.set(key, { since: time, count: 1 });
      return event;
    }
    entry.count += 1;
    return entry.count <= MAX_PER_WINDOW ? event : null;
  };
}
