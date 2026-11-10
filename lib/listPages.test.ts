// ABOUTME: Tests for loading a list a page at a time: page numbers, ranges and ranks.
// ABOUTME: Covers pages past the end, which the API refuses instead of returning empty.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchListPage,
  LIST_PAGE_SIZE,
  pageCount,
  pageOfRank,
  pageRange,
  pagerPages,
  parsePage,
} from "./listPages";

test("reads a page number from the address, or page 1", () => {
  assert.equal(parsePage("3"), 3);
  assert.equal(parsePage(undefined), 1);
  assert.equal(parsePage(""), 1);
  assert.equal(parsePage("0"), 1);
  assert.equal(parsePage("-2"), 1);
  assert.equal(parsePage("2.5"), 1);
  assert.equal(parsePage("1e3"), 1);
  assert.equal(parsePage("abc"), 1);
  assert.equal(parsePage(["2", "3"]), 1);
  assert.equal(parsePage("99999999999"), 1);
});

test("a list of up to 10,000 items fills whole pages and a part page", () => {
  assert.equal(pageCount(0), 1);
  assert.equal(pageCount(1), 1);
  assert.equal(pageCount(LIST_PAGE_SIZE), 1);
  assert.equal(pageCount(LIST_PAGE_SIZE + 1), 2);
  assert.equal(pageCount(10000), Math.ceil(10000 / LIST_PAGE_SIZE));
});

test("each rank is on exactly one page, and pages meet without a gap", () => {
  for (let page = 1; page <= pageCount(10000); page++) {
    const { from, to } = pageRange(page);
    assert.equal(to - from + 1, LIST_PAGE_SIZE);
    assert.equal(pageOfRank(from + 1), page);
    assert.equal(pageOfRank(to + 1), page);
    if (page > 1) assert.equal(from, pageRange(page - 1).to + 1);
  }
  assert.equal(pageRange(1).from, 0);
});

test("the pager shows the ends and the neighbours of the current page", () => {
  assert.deepEqual(pagerPages(1, 1), [1]);
  assert.deepEqual(pagerPages(1, 3), [1, 2, 3]);
  assert.deepEqual(pagerPages(1, 10), [1, 2, null, 10]);
  assert.deepEqual(pagerPages(5, 10), [1, null, 4, 5, 6, null, 10]);
  assert.deepEqual(pagerPages(10, 10), [1, null, 9, 10]);
  // A gap of one page shows that page instead
  assert.deepEqual(pagerPages(4, 10), [1, 2, 3, 4, 5, null, 10]);
  assert.deepEqual(pagerPages(7, 10), [1, null, 6, 7, 8, 9, 10]);
});

type Call = { method: string; args: unknown[] };

// A stand-in for the query builder that records the calls made on it and
// answers with the given responses in turn
function fakeSupabase(responses: unknown[]) {
  const calls: Call[] = [];
  const builder = (response: unknown) => {
    // Awaiting the query gives the response
    const chain = Promise.resolve(response) as Promise<unknown> &
      Record<string, unknown>;
    for (const method of ["select", "eq", "order", "range"]) {
      chain[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return chain;
      };
    }
    return chain;
  };
  const client = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return builder(responses.shift());
    },
  };
  return { calls, supabase: client as unknown as SupabaseClient };
}

test("asks for one page of rows in a stable order, with the total", async () => {
  const { calls, supabase } = fakeSupabase([
    {
      data: [
        {
          item_id: "Dune",
          items: { title: "Dune", image_url: "d.jpg", image_hidden: false },
        },
        { item_id: "Gone", items: null },
      ],
      count: 1200,
      error: null,
    },
  ]);

  const result = await fetchListPage(supabase, "list-1", 3);

  const range = calls.find((c) => c.method === "range");
  assert.deepEqual(range?.args, [2 * LIST_PAGE_SIZE, 3 * LIST_PAGE_SIZE - 1]);
  assert.deepEqual(
    calls.filter((c) => c.method === "order").map((c) => c.args[0]),
    ["position", "item_id"],
  );
  assert.deepEqual(calls.find((c) => c.method === "eq")?.args, [
    "list_id",
    "list-1",
  ]);
  assert.equal(result.total, 1200);
  assert.deepEqual(result.entries, [
    {
      itemId: "Dune",
      rank: 2 * LIST_PAGE_SIZE + 1,
      title: "Dune",
      imageUrl: "d.jpg",
      imageHidden: false,
    },
    {
      itemId: "Gone",
      rank: 2 * LIST_PAGE_SIZE + 2,
      title: "Unknown item",
      imageUrl: null,
      imageHidden: false,
    },
  ]);
});

test("a page past the end comes back empty, with the list's real length", async () => {
  const { calls, supabase } = fakeSupabase([
    {
      data: null,
      count: null,
      error: { code: "PGRST103", message: "Requested range not satisfiable" },
    },
    { data: null, count: 130, error: null },
  ]);

  const result = await fetchListPage(supabase, "list-1", 9);

  assert.equal(calls.filter((c) => c.method === "from").length, 2);
  assert.deepEqual(result, { entries: [], total: 130 });
  assert.equal(pageCount(result.total), 2);
});

test("other errors are passed on", async () => {
  const { supabase } = fakeSupabase([
    { data: null, count: null, error: { code: "57014", message: "timeout" } },
  ]);
  const result = await fetchListPage(supabase, "list-1", 1);
  assert.deepEqual(result, { entries: [], total: 0, error: "timeout" });
});
