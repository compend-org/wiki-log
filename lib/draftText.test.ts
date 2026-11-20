// ABOUTME: Tests for the text shown while writing a review or comment, and how edits
// ABOUTME: around links in it turn back into the stored text.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findChange,
  formatMarks,
  insertDraft,
  listEnter,
  replaceText,
  sliceDraft,
  toDraft,
  toggleMarker,
  toStored,
} from "./draftText";
import { mentionToken, webLinkToken } from "./format";

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
  const withAnn = insertDraft(draft, 3, 4, toDraft(ANN));
  assert.equal(withAnn.draft.text, "Hi @Ann and ::link");
  assert.equal(withAnn.caret, 7);
  const both = insertDraft(
    withAnn.draft,
    12,
    18,
    toDraft("[[Q42|Douglas Adams]]"),
  );
  assert.equal(toStored(both.draft), `Hi ${ANN} and [[Q42|Douglas Adams]]`);
});

test("keeps links through cutting and pasting back", () => {
  const draft = toDraft(STORED);
  const cut = sliceDraft(draft, 0, draft.text.length);
  assert.equal(toStored(cut), STORED);
  const emptied = replaceText(draft, 0, draft.text.length, "").draft;
  assert.equal(toStored(insertDraft(emptied, 0, 0, cut).draft), STORED);
});

test("copies a link only partly selected as plain text", () => {
  // "@Ann about Doug"
  const piece = sliceDraft(toDraft(STORED), 4, 19);
  assert.equal(toStored(piece), `${ANN} about Doug`);
});

test("pastes links into the middle of text", () => {
  const piece = toDraft(`see ${ANN} `);
  const { draft, caret } = insertDraft(toDraft("Go [[Q1|Earth]]"), 3, 3, piece);
  assert.equal(toStored(draft), `Go see ${ANN} [[Q1|Earth]]`);
  assert.equal(caret, 12);
});

test("shows a web link by its words and stores it back as markdown", () => {
  const stored = "Watch [the restoration](https://example.com/a) tonight";
  const draft = toDraft(stored);
  assert.equal(draft.text, "Watch the restoration tonight");
  assert.equal(toStored(draft), stored);
  // Deleting into the words removes the whole link
  assert.equal(
    edit(stored, "Watch the restoratio tonight", 20),
    "Watch  tonight",
  );
});

test("bolds and unbolds the selected text", () => {
  const draft = toDraft("an offer he can't refuse");
  const bold = toggleMarker(draft, 3, 8, "**");
  assert.equal(bold.draft.text, "an **offer** he can't refuse");
  assert.deepEqual([bold.start, bold.end], [5, 10]);
  const plain = toggleMarker(bold.draft, bold.start, bold.end, "**");
  assert.equal(plain.draft.text, "an offer he can't refuse");
  assert.deepEqual([plain.start, plain.end], [3, 8]);
});

test("bold leaves spaces at the ends of the selection outside it", () => {
  const bold = toggleMarker(toDraft("an offer he"), 2, 9, "**");
  assert.equal(bold.draft.text, "an **offer** he");
  assert.deepEqual([bold.start, bold.end], [5, 10]);
});

test("italic and bold stack without undoing each other", () => {
  const bold = toggleMarker(toDraft("offer"), 0, 5, "**");
  const both = toggleMarker(bold.draft, bold.start, bold.end, "*");
  assert.equal(both.draft.text, "***offer***");
  const justBold = toggleMarker(both.draft, both.start, both.end, "*");
  assert.equal(justBold.draft.text, "**offer**");
});

test("marking text that cuts into a link takes the whole link", () => {
  // Selects "Ask @A", which ends inside "@Ann"
  const { draft } = toggleMarker(toDraft(STORED), 0, 6, "**");
  assert.equal(toStored(draft), `**Ask ${ANN}** about [[Q42|Douglas Adams]].`);
});

test("finds markdown marks and bold text", () => {
  const text = "> **big** *small* ~~gone~~\n- item";
  const found = formatMarks(text).map(
    (m) => `${m.kind}:${text.slice(m.start, m.end)}`,
  );
  assert.deepEqual(found.sort(), [
    "bold:big",
    "mark:*",
    "mark:*",
    "mark:**",
    "mark:**",
    "mark:-",
    "mark:>",
    "mark:~~",
    "mark:~~",
  ]);
});

// Presses Enter at the | in `text`, returning the text with the caret as a |
function enter(text: string): string | null {
  const caret = text.indexOf("|");
  const next = listEnter(toDraft(text.replace("|", "")), caret);
  if (!next) return null;
  const shown = next.draft.text;
  return `${shown.slice(0, next.caret)}|${shown.slice(next.caret)}`;
}

test("Enter on a list item starts the next one", () => {
  assert.equal(enter("Ranked:\n- the cannoli|"), "Ranked:\n- the cannoli\n- |");
  assert.equal(enter("* one|\nafter"), "* one\n* |\nafter");
  assert.equal(enter("  + nested|"), "  + nested\n  + |");
  assert.equal(enter("9. nine|"), "9. nine\n10. |");
  assert.equal(enter("1) one|"), "1) one\n2) |");
});

test("Enter in the middle of a list item moves the rest to the next one", () => {
  assert.equal(enter("- the can|noli"), "- the can\n- |noli");
});

test("Enter on an empty list item ends the list", () => {
  assert.equal(enter("- one\n- |"), "- one\n\n|");
  assert.equal(enter("- one\n2. |"), "- one\n\n|");
  assert.equal(enter("- |"), "|");
});

test("Enter outside a list item is left to the box", () => {
  assert.equal(enter("plain|"), null);
  assert.equal(enter("-not a bullet|"), null);
  assert.equal(enter("|- one"), null);
  assert.equal(enter("-| one"), null);
  assert.equal(enter("**bold**|"), null);
});

test("Enter keeps links on the list item", () => {
  const next = listEnter(toDraft(`- ${ANN}`), toDraft(`- ${ANN}`).text.length);
  assert.ok(next);
  assert.equal(toStored(next.draft), `- ${ANN}\n- `);
});

test("a link keeps every word of a long selection", () => {
  const words = "word ".repeat(50).trim();
  const draft = toDraft(webLinkToken(words, "https://example.com"));
  assert.equal(draft.text, words);
  assert.equal(draft.links.length, 1);
});
