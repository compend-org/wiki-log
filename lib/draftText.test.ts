// ABOUTME: Tests for the text shown while writing a review or comment, and how edits
// ABOUTME: around links in it turn back into the stored text.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findChange,
  insertLink,
  replaceText,
  toDraft,
  toStored,
} from "./draftText";
import { mentionToken } from "./format";

const ANN = mentionToken("65617370-d22f-4d75-9bf4-456e8caee319", "Ann");
const STORED = `Ask ${ANN} about [[Q42|Douglas Adams]].`;

// Applies a text box edit the way the review box does
function edit(stored: string, after: string, caret: number): string {
  const draft = toDraft(stored);
  const { start, end, inserted } = findChange(draft.text, after, caret);
  return toStored(replaceText(draft, start, end, inserted).draft);
}

test("shows links by their labels and stores them back as tokens", () => {
  const draft = toDraft(STORED);
  assert.equal(draft.text, "Ask @Ann about Douglas Adams.");
  assert.equal(toStored(draft), STORED);
});

test("typing next to a link keeps it", () => {
  // "Ask @Ann| about…" → "Ask @Ann!| about…"
  assert.equal(
    edit(STORED, "Ask @Ann! about Douglas Adams.", 9),
    `Ask ${ANN}! about [[Q42|Douglas Adams]].`,
  );
  // "Ask |@Ann…" → "Ask x|@Ann…"
  assert.equal(
    edit(STORED, "Ask x@Ann about Douglas Adams.", 5),
    `Ask x${ANN} about [[Q42|Douglas Adams]].`,
  );
});

test("backspacing into a link removes all of it", () => {
  // Caret right after "@Ann", one backspace
  assert.equal(
    edit(STORED, "Ask @An about Douglas Adams.", 7),
    "Ask  about [[Q42|Douglas Adams]].",
  );
});

test("typing inside a link removes it and keeps what was typed", () => {
  // "Douglas| Adams" → "Douglasx Adams"
  assert.equal(
    edit(STORED, "Ask @Ann about Douglasx Adams.", 23),
    `Ask ${ANN} about x.`,
  );
});

test("finds a change after a repeated letter", () => {
  assert.deepEqual(findChange("aa", "aaa", 2), {
    start: 1,
    end: 1,
    inserted: "a",
  });
});

test("finds a change when the caret doesn't follow it", () => {
  assert.deepEqual(findChange("abcdef", "abXef", 0), {
    start: 2,
    end: 4,
    inserted: "X",
  });
});

test("puts a link in place of what was typed to ask for it", () => {
  const draft = toDraft("Hi @ and ::link");
  const withAnn = insertLink(draft, 3, 4, ANN);
  assert.equal(withAnn.draft.text, "Hi @Ann and ::link");
  assert.equal(withAnn.caret, 7);
  const both = insertLink(withAnn.draft, 12, 18, "[[Q42|Douglas Adams]]");
  assert.equal(toStored(both.draft), `Hi ${ANN} and [[Q42|Douglas Adams]]`);
});
