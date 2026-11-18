// ABOUTME: The rules for a list item's note: what's saved for what was typed, and how long it may be.
// ABOUTME: Shared by the list editor, "Add to list" and the server, so they all count the same way.

// The longest note, in characters as the database counts them
export const MAX_NOTE_LENGTH = 500;

// How long a note is, counted the way the database counts it: an emoji made
// of two UTF-16 units is one character
export function noteLength(text: string): number {
  return [...text].length;
}

// What to save for the typed text: the text without surrounding spaces, or
// null when nothing is left
export function cleanListNote(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === "" ? null : trimmed;
}

// Why the typed text can't be saved as a note, if it can't
export function noteProblem(text: string): string | null {
  const over = noteLength(text.trim()) - MAX_NOTE_LENGTH;
  if (over > 0) {
    return `${over.toLocaleString("en-US")} ${over === 1 ? "character" : "characters"} over. Shorten it to save.`;
  }
  return null;
}
