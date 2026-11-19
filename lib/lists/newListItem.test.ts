// ABOUTME: Tests for reading which item a new list starts with from the address.
// ABOUTME: Checks one id is used and that empty, repeated or overlong values are ignored.
import assert from "node:assert/strict";
import { test } from "node:test";
import { addParam } from "./newListItem";

test("one item id is used", () => {
  assert.equal(addParam("Q15055478"), "Q15055478");
  assert.equal(addParam("  Q42 "), "Q42");
});

test("nothing, empty or repeated values are ignored", () => {
  assert.equal(addParam(undefined), null);
  assert.equal(addParam(""), null);
  assert.equal(addParam("   "), null);
  assert.equal(addParam(["Q1", "Q2"]), null);
});

test("an overlong value is ignored", () => {
  assert.equal(addParam("Q".repeat(101)), null);
  assert.equal(addParam("Q".repeat(100)), "Q".repeat(100));
});
