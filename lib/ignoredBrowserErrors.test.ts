// ABOUTME: Tests which errors Sentry drops when given the ignored browser error patterns.
// ABOUTME: Checks that real errors with similar wording are still reported.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as Sentry from "@sentry/nextjs";
import { IGNORED_BROWSER_ERRORS } from "./ignoredBrowserErrors";

const sent: string[] = [];
Sentry.init({
  dsn: "https://public@example.invalid/1",
  ignoreErrors: IGNORED_BROWSER_ERRORS,
  beforeSend(event) {
    const error = event.exception?.values?.[0];
    sent.push(`${error?.type}: ${error?.value}`);
    return null;
  },
});

function named(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

test("drops dropped connections, cancellations and wallet extension errors only", async () => {
  const dropped = [
    new TypeError("Load failed"),
    new TypeError("Load failed (compend.org)"),
    new TypeError("Failed to fetch"),
    new TypeError("Failed to fetch (compend.org)"),
    new TypeError("NetworkError when attempting to fetch resource."),
    new TypeError("network error"),
    named("AbortError", "signal is aborted without reason"),
    new TypeError(
      "undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')",
    ),
  ];
  const kept = [
    new TypeError("Load failed to parse the response"),
    new TypeError("Failed to fetch the list's items"),
    named("AbortError", "The user aborted a request."),
    new RangeError("Maximum call stack size exceeded."),
  ];
  for (const error of [...dropped, ...kept]) Sentry.captureException(error);
  await Sentry.flush();

  // Events finish processing in any order
  assert.deepEqual(
    sent.toSorted(),
    kept.map((e) => `${e.name}: ${e.message}`).toSorted(),
  );
});
