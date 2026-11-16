// ABOUTME: Tests which Supabase error messages are shown to people and which are hidden.
// ABOUTME: Messages written for people pass; ones naming tables, columns or server failures don't.
import assert from "node:assert/strict";
import { test } from "node:test";
import { authMessage, userFacingErrorMessage } from "./userFacingErrorMessage";

const fallback = "Couldn't save that.";

test("a database error naming a column is hidden", () => {
  assert.equal(
    userFacingErrorMessage(
      {
        code: "42703",
        message: "column list_items_2.image_url does not exist",
      },
      fallback,
    ),
    fallback,
  );
});

test("a permission error naming a table is hidden", () => {
  assert.equal(
    userFacingErrorMessage(
      { code: "42501", message: "permission denied for table blocks" },
      fallback,
    ),
    fallback,
  );
  assert.equal(
    userFacingErrorMessage(
      {
        code: "42501",
        message:
          'new row violates row-level security policy for table "list_items"',
      },
      fallback,
    ),
    fallback,
  );
});

test("a message the database raised for people is shown", () => {
  assert.equal(
    userFacingErrorMessage(
      { code: "P0001", message: "You can have at most 50 lists." },
      fallback,
    ),
    "You can have at most 50 lists.",
  );
  assert.equal(
    userFacingErrorMessage(
      { code: "42501", message: "Your account is suspended" },
      fallback,
    ),
    "Your account is suspended",
  );
});

test("an error without a code is hidden", () => {
  assert.equal(
    userFacingErrorMessage({ message: "TypeError: fetch failed" }, fallback),
    fallback,
  );
});

test("sign-in messages written for people are shown", () => {
  assert.equal(
    authMessage(
      { status: 422, message: "Password should be at least 6 characters." },
      fallback,
    ),
    "Password should be at least 6 characters.",
  );
});

test("sign-in failures inside Supabase are hidden", () => {
  assert.equal(
    authMessage(
      { status: 500, message: "Database error saving new user" },
      fallback,
    ),
    fallback,
  );
  assert.equal(
    authMessage(
      { status: 400, message: "Database error querying schema" },
      fallback,
    ),
    fallback,
  );
  assert.equal(authMessage({ message: "fetch failed" }, fallback), fallback);
});
