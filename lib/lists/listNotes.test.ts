// ABOUTME: Tests for the rules of list item notes.
// ABOUTME: Covers trimming, counting characters like the database, and the length limit.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanListNote,
  MAX_NOTE_LENGTH,
  noteLength,
  noteProblem,
} from "@/lib/lists/listNotes";

test("a note is saved without the spaces around it", () => {
  assert.equal(cleanListNote("  Fight me.\n"), "Fight me.");
});

test("a note of only spaces is no note", () => {
  assert.equal(cleanListNote(" \n\t "), null);
});

test("line breaks inside a note are kept", () => {
  assert.equal(cleanListNote("One.\n\nTwo."), "One.\n\nTwo.");
});

test("an emoji counts as one character, as in the database", () => {
  assert.equal(noteLength("🍜"), 1);
  assert.equal("🍜".length, 2);
});

test("a note at the limit is fine and one past it says by how much", () => {
  assert.equal(noteProblem("a".repeat(MAX_NOTE_LENGTH)), null);
  assert.equal(
    noteProblem("a".repeat(MAX_NOTE_LENGTH + 1)),
    "1 character over. Shorten it to save.",
  );
  assert.equal(
    noteProblem("a".repeat(MAX_NOTE_LENGTH + 23)),
    "23 characters over. Shorten it to save.",
  );
});

test("spaces around a note don't count toward the limit", () => {
  assert.equal(noteProblem(`  ${"a".repeat(MAX_NOTE_LENGTH)}  `), null);
});
