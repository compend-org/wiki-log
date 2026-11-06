// ABOUTME: Tests for recognising errors caused by a dropped or failed connection.
// ABOUTME: Covers each browser's wording and errors that aren't about the connection.
import assert from "node:assert/strict";
import { test } from "node:test";
import { isConnectionError } from "./connectionError";

test("recognises each browser's failed fetch", () => {
  assert.ok(isConnectionError(new TypeError("network error")));
  assert.ok(isConnectionError(new TypeError("Failed to fetch")));
  assert.ok(
    isConnectionError(
      new TypeError("NetworkError when attempting to fetch resource."),
    ),
  );
  assert.ok(isConnectionError(new TypeError("Load failed")));
});

test("ignores other errors", () => {
  assert.equal(
    isConnectionError(new TypeError("Cannot read properties of null")),
    false,
  );
  assert.equal(isConnectionError(new Error("network error")), false);
  assert.equal(isConnectionError("network error"), false);
});
