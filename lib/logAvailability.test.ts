// ABOUTME: Tests exact log foreign-key detection and shared missing-log state.
// ABOUTME: Verifies stale-log errors skip Sentry while unexpected reaction errors are reported.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isLogUnavailable,
  markLogUnavailable,
  subscribeToLogAvailability,
} from "./logAvailability";
import { isMissingLogError } from "./missingLogError";
import { describeFailedRequest } from "./supabase/reportFailedResponses";

function foreignKeyError(table: string, column: string) {
  return {
    code: "23503",
    message: `insert or update on table "${table}" violates foreign key constraint "${table}_${column}_fkey"`,
  };
}

test("recognizes only the affected reaction's log foreign key", () => {
  for (const table of ["likes", "shares"] as const) {
    assert.equal(
      isMissingLogError(foreignKeyError(table, "log_id"), table),
      true,
    );
    for (const column of ["user_id", "list_id"]) {
      assert.equal(
        isMissingLogError(foreignKeyError(table, column), table),
        false,
      );
    }
    assert.equal(
      isMissingLogError(
        { ...foreignKeyError(table, "log_id"), code: "23505" },
        table,
      ),
      false,
    );
    assert.equal(
      isMissingLogError({ code: "42501", message: "permission denied" }, table),
      false,
    );
  }
  assert.equal(
    isMissingLogError(foreignKeyError("shares", "log_id"), "likes"),
    false,
  );
  assert.equal(
    isMissingLogError(foreignKeyError("list_likes", "list_id"), "likes"),
    false,
  );
});

test("missing log state reaches every subscriber and persists after unsubscribing", () => {
  const id = "deleted-log";
  let likeUpdates = 0;
  let shareUpdates = 0;
  const stopLike = subscribeToLogAvailability(() => likeUpdates++);
  const stopShare = subscribeToLogAvailability(() => shareUpdates++);

  assert.equal(isLogUnavailable(id), false);
  markLogUnavailable(id);
  assert.equal(isLogUnavailable(id), true);
  assert.equal(likeUpdates, 1);
  assert.equal(shareUpdates, 1);
  assert.equal(isLogUnavailable("another-log"), false);
  // List shares opt out, even when their UUID matches a missing log.
  assert.equal(isLogUnavailable(null), false);

  stopLike();
  stopShare();
  markLogUnavailable(id);
  assert.equal(likeUpdates, 1);
  assert.equal(shareUpdates, 1);
  assert.equal(isLogUnavailable(id), true);
});

test("stale log errors are not reported to Sentry", async () => {
  for (const table of ["likes", "shares"] as const) {
    const failure = await describeFailedRequest(
      `https://example.supabase.co/rest/v1/${table}`,
      "POST",
      Response.json(foreignKeyError(table, "log_id"), { status: 409 }),
    );
    assert.equal(failure, null);
  }
});

test("unexpected reaction errors remain reportable to Sentry", async () => {
  for (const table of ["likes", "shares"] as const) {
    for (const column of ["user_id", "list_id"]) {
      const error = foreignKeyError(table, column);
      const failure = await describeFailedRequest(
        `https://example.supabase.co/rest/v1/${table}`,
        "POST",
        Response.json(error, { status: 409 }),
      );
      assert.deepEqual(failure, {
        method: "POST",
        resource: table,
        status: 409,
        ...error,
      });
    }
  }
});
