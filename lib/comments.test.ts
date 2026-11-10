// ABOUTME: Tests for loading comments as whole threads: how many to show, the link for more, and their order.
// ABOUTME: Covers odd values in the URL, keeping other query parameters, and replies staying under their thread.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  inThreadOrder,
  parseThreads,
  THREADS_PER_PAGE,
  threadsHref,
} from "./comments";

test("shows a page of threads unless the URL asks for more", () => {
  assert.equal(parseThreads(undefined), THREADS_PER_PAGE);
  assert.equal(parseThreads("abc"), THREADS_PER_PAGE);
  assert.equal(parseThreads(["200", "300"]), THREADS_PER_PAGE);
  assert.equal(parseThreads("0"), THREADS_PER_PAGE);
  assert.equal(parseThreads("-500"), THREADS_PER_PAGE);
  assert.equal(parseThreads("200"), 200);
  // Rounded down to whole pages
  assert.equal(parseThreads("250"), 200);
  // And capped
  assert.equal(parseThreads("1e9"), 10_000);
});

test("the link for older threads keeps the rest of the query string", () => {
  assert.equal(
    threadsHref("/list/abc", { page: "3", comments: "100" }, 200),
    "/list/abc?page=3&comments=200",
  );
  assert.equal(threadsHref("/u/a/b", {}, 200), "/u/a/b?comments=200");
  assert.equal(
    threadsHref("/x", { tag: ["a", "b"], gone: undefined }, 300),
    "/x?tag=a&tag=b&comments=300",
  );
});

test("threads come oldest first, with replies after them oldest first", () => {
  const c = (id: string, minute: number) => ({
    id,
    created_at: `2026-11-05T12:${String(minute).padStart(2, "0")}:00+00:00`,
  });
  // Loaded newest first
  const top = [c("t3", 30), c("t2", 20), c("t1", 10)];
  const replies = [c("r2", 25), c("r1", 15), c("r3", 25)];
  assert.deepEqual(
    inThreadOrder(top, replies).map((x) => x.id),
    ["t1", "t2", "t3", "r1", "r2", "r3"],
  );
});
