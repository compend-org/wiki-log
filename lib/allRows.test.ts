// ABOUTME: Tests for reading past the API's row limit a response at a time.
// ABOUTME: Covers stopping at a short response, a limit, errors, and splitting ids into runs.
import assert from "node:assert/strict";
import { test } from "node:test";
import { API_MAX_ROWS, chunks, fetchRows } from "./allRows";

// A table of `size` rows, served the way the API serves .range(): at most
// API_MAX_ROWS at a time
function table(size: number) {
  const asked: [number, number][] = [];
  const page = async (from: number, to: number) => {
    asked.push([from, to]);
    const end = Math.min(to + 1, size, from + API_MAX_ROWS);
    const data = Array.from({ length: Math.max(0, end - from) }, (_, i) => ({
      n: from + i,
    }));
    return { data, error: null };
  };
  return { asked, page };
}

test("reads every row of a table bigger than one response", async () => {
  const { asked, page } = table(2500);
  const { rows, error } = await fetchRows<{ n: number }>(page);
  assert.equal(error, undefined);
  assert.equal(rows.length, 2500);
  assert.deepEqual(
    rows.map((r) => r.n),
    Array.from({ length: 2500 }, (_, i) => i),
  );
  assert.deepEqual(asked, [
    [0, 999],
    [1000, 1999],
    [2000, 2999],
  ]);
});

test("asks once more when the table is a whole number of responses", async () => {
  const { asked, page } = table(2000);
  const { rows } = await fetchRows(page);
  assert.equal(rows.length, 2000);
  assert.equal(asked.length, 3);
});

test("stops at the limit without asking for more", async () => {
  const { asked, page } = table(5000);
  const { rows } = await fetchRows(page, 1200);
  assert.equal(rows.length, 1200);
  assert.deepEqual(asked, [
    [0, 999],
    [1000, 1199],
  ]);
});

test("keeps what it read before an error and says what went wrong", async () => {
  let calls = 0;
  const { rows, error } = await fetchRows(async () => {
    calls += 1;
    return calls === 1
      ? { data: Array.from({ length: API_MAX_ROWS }, () => ({})), error: null }
      : { data: null, error: { message: "timeout" } };
  });
  assert.equal(rows.length, API_MAX_ROWS);
  assert.equal(error, "timeout");
});

test("splits values into runs of at most the given size", () => {
  assert.deepEqual(chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunks([], 2), []);
});
