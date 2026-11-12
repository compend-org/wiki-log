// ABOUTME: Tests that repeats of one error stop being sent to Sentry after a few each hour.
// ABOUTME: Different errors are counted apart, and the count starts over once the hour is up.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ErrorEvent } from "@sentry/nextjs";
import { limitRepeatedErrors } from "./repeatedErrors";

function thrown(type: string, value: string): ErrorEvent {
  return { type: undefined, exception: { values: [{ type, value }] } };
}

function sentCount(
  filter: (event: ErrorEvent) => ErrorEvent | null,
  event: ErrorEvent,
  times: number,
) {
  let sent = 0;
  for (let i = 0; i < times; i++) if (filter(event)) sent++;
  return sent;
}

test("an error repeated many times is sent only three times", () => {
  const filter = limitRepeatedErrors(() => 0);
  assert.equal(sentCount(filter, thrown("TypeError", "boom"), 10), 3);
});

test("errors with different messages are counted apart", () => {
  const filter = limitRepeatedErrors(() => 0);
  assert.equal(sentCount(filter, thrown("TypeError", "boom"), 5), 3);
  assert.equal(sentCount(filter, thrown("TypeError", "bang"), 5), 3);
});

test("events with one fingerprint count as the same error", () => {
  const filter = limitRepeatedErrors(() => 0);
  const failure = (message: string): ErrorEvent => ({
    ...thrown("SupabaseError", message),
    fingerprint: ["supabase", "logs", "42501"],
  });
  for (let i = 0; i < 3; i++) assert.ok(filter(failure(`attempt ${i}`)));
  assert.equal(filter(failure("attempt 3")), null);
});

test("the count starts over after an hour", () => {
  let now = 0;
  const filter = limitRepeatedErrors(() => now);
  const event = thrown("TypeError", "boom");
  assert.equal(sentCount(filter, event, 5), 3);
  now = 60 * 60 * 1000;
  assert.equal(sentCount(filter, event, 5), 3);
});
