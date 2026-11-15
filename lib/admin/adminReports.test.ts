// ABOUTME: Tests the small rules behind the admin reports pages.
// ABOUTME: Covers post links, a post's combined status, and spotting freshly made accounts.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  combinedStatus,
  countLabel,
  gapLabel,
  postHref,
  reportedSoonAfterJoining,
} from "./adminReports";

test("a post links to the public page it appears on", () => {
  assert.equal(
    postHref({ exists: true, href_log: { username: "a b", id: "1" } }),
    "/u/a%20b/1",
  );
  assert.equal(postHref({ exists: true, list_id: "2" }), "/list/2");
  assert.equal(postHref({ exists: false }), null);
});

test("a post stays open until none of its reports are", () => {
  assert.equal(
    combinedStatus([{ status: "dismissed" }, { status: "open" }]),
    "open",
  );
  assert.equal(
    combinedStatus([{ status: "dismissed" }, { status: "actioned" }]),
    "actioned",
  );
  assert.equal(combinedStatus([{ status: "dismissed" }]), "dismissed");
});

test("a count agrees with its number", () => {
  assert.equal(countLabel(0, "list"), "0 lists");
  assert.equal(countLabel(1, "list"), "1 list");
  assert.equal(countLabel(2, "list"), "2 lists");
});

test("a gap reads in the most natural unit", () => {
  const start = "2026-11-05T20:40:00Z";
  assert.equal(gapLabel(start, "2026-11-05T20:49:00Z"), "9 min");
  assert.equal(gapLabel(start, "2026-11-06T01:40:00Z"), "5 h");
  assert.equal(gapLabel(start, "2026-11-08T20:40:00Z"), "3 days");
});

test("only a report within a day of joining counts as soon", () => {
  const joined = "2026-11-05T20:40:00Z";
  assert.equal(reportedSoonAfterJoining(joined, "2026-11-05T20:49:00Z"), true);
  assert.equal(reportedSoonAfterJoining(joined, "2026-11-07T20:40:00Z"), false);
  // Accounts that signed up after being reported can't happen, but clocks can
  assert.equal(reportedSoonAfterJoining(joined, "2026-11-05T20:00:00Z"), false);
});
