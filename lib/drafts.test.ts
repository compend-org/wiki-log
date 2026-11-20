// ABOUTME: Tests for the checks on a list draft before it is stored.
// ABOUTME: An untitled or empty draft is fine; a malformed or oversized one is refused.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type ListDraftFields,
  listDraftProblem,
  MAX_DRAFT_ITEMS,
} from "@/lib/drafts";
import { MAX_NOTE_LENGTH } from "@/lib/lists/listNotes";

function draft(overrides: Partial<ListDraftFields> = {}): ListDraftFields {
  return {
    grouped: false,
    title: "Breakfasts I'd defend in court",
    description: "",
    ranked: true,
    labeled: true,
    content: {
      groups: [{ name: "", items: ["Q13202", "Q11259"] }],
      notes: { Q13202: "Only if it shatters when you bite it." },
      pictures: { Q11259: "https://upload.wikimedia.org/a.jpg" },
    },
    ...overrides,
  };
}

test("a list draft with items, notes and pictures can be stored", () => {
  assert.equal(listDraftProblem(draft()), null);
});

test("an untitled draft with no items can be stored", () => {
  assert.equal(
    listDraftProblem(
      draft({
        title: "",
        content: { groups: [{ name: "", items: [] }], notes: {}, pictures: {} },
      }),
    ),
    null,
  );
});

test("a draft needs at least one group", () => {
  assert.equal(
    listDraftProblem(
      draft({ content: { groups: [], notes: {}, pictures: {} } }),
    ),
    "invalidGroups",
  );
});

test("an item may only be in a draft once, across all its groups", () => {
  assert.equal(
    listDraftProblem(
      draft({
        grouped: true,
        content: {
          groups: [
            { name: "Sweet", items: ["Q13202"] },
            { name: "Savoury", items: ["Q13202"] },
          ],
          notes: {},
          pictures: {},
        },
      }),
    ),
    "invalidItems",
  );
});

test("item IDs must look like items", () => {
  assert.equal(
    listDraftProblem(
      draft({
        content: {
          groups: [{ name: "", items: ["drop table"] }],
          notes: {},
          pictures: {},
        },
      }),
    ),
    "invalidItems",
  );
});

test("a draft can't hold more items than a list", () => {
  const items = Array.from(
    { length: MAX_DRAFT_ITEMS + 1 },
    (_, i) => `Q${i + 1}`,
  );
  assert.equal(
    listDraftProblem(
      draft({
        content: { groups: [{ name: "", items }], notes: {}, pictures: {} },
      }),
    ),
    "invalidItems",
  );
});

test("notes and pictures must be for items in the draft", () => {
  const base = draft().content;
  assert.equal(
    listDraftProblem(draft({ content: { ...base, notes: { Q1: "Hm." } } })),
    "invalidNotes",
  );
  assert.equal(
    listDraftProblem(
      draft({ content: { ...base, pictures: { Q1: "https://x" } } }),
    ),
    "invalidPictures",
  );
});

test("a note that's too long is refused", () => {
  const base = draft().content;
  assert.equal(
    listDraftProblem(
      draft({
        content: {
          ...base,
          notes: { Q13202: "a".repeat(MAX_NOTE_LENGTH + 2) },
        },
      }),
    ),
    "invalidNotes",
  );
});

test("a title past 80 characters is refused", () => {
  assert.equal(
    listDraftProblem(draft({ title: "a".repeat(81) })),
    "titleLength",
  );
});

test("something that isn't a draft is refused", () => {
  assert.equal(listDraftProblem(null), "invalidDraft");
  assert.equal(listDraftProblem({ ...draft(), ranked: "yes" }), "invalidDraft");
  assert.equal(
    listDraftProblem({
      ...draft(),
      content: { groups: [], notes: [], pictures: {} },
    }),
    "invalidDraft",
  );
});
