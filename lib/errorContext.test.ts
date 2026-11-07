// ABOUTME: Tests that withErrorContext attaches context to errors reported during its work.
// ABOUTME: Verifies the context is gone from errors reported after the work finishes.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as Sentry from "@sentry/nextjs";
import { withErrorContext } from "./errorContext";

const sent: Sentry.ErrorEvent[] = [];
Sentry.init({
  dsn: "https://public@example.invalid/1",
  beforeSend(event) {
    sent.push(event);
    return null;
  },
});

test("reported errors carry the context only while the work runs", async () => {
  const result = await withErrorContext(
    "favourite",
    { itemId: "Q536560", position: 3 },
    async () => {
      Sentry.captureMessage("during");
      return "done";
    },
  );
  Sentry.captureMessage("after");
  await Sentry.flush();

  assert.equal(result, "done");
  const during = sent.find((e) => e.message === "during");
  const after = sent.find((e) => e.message === "after");
  assert.deepEqual(during?.contexts?.favourite, {
    itemId: "Q536560",
    position: 3,
  });
  assert.equal(after?.contexts?.favourite, undefined);
});
