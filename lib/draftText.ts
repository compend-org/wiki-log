// ABOUTME: Turns review and comment text, with its link tokens, into the text shown while writing it.
// ABOUTME: Keeps track of where each link sits, so an edit that touches a link removes it whole.
import { REVIEW_LINK } from "@/lib/format";

// A link in the draft: where its label sits, and the token stored for it
export type DraftLink = { start: number; end: number; token: string };

// Text as it shows while writing it: each link reads as its label
export type Draft = { text: string; links: DraftLink[] };

// How a link reads while writing: @username for a person, the title for an item
function linkLabel(id: string, title: string): string {
  return id.startsWith("@") ? `@${title}` : title;
}

export function toDraft(stored: string): Draft {
  let text = "";
  const links: DraftLink[] = [];
  let last = 0;
  for (const m of stored.matchAll(REVIEW_LINK)) {
    const at = m.index ?? 0;
    text += stored.slice(last, at);
    const label = linkLabel(m[1], m[2]);
    links.push({
      start: text.length,
      end: text.length + label.length,
      token: m[0],
    });
    text += label;
    last = at + m[0].length;
  }
  return { text: text + stored.slice(last), links };
}

export function toStored(draft: Draft): string {
  let stored = "";
  let last = 0;
  for (const link of draft.links) {
    stored += draft.text.slice(last, link.start) + link.token;
    last = link.end;
  }
  return stored + draft.text.slice(last);
}

// Replaces the draft's text from `start` to `end` with `inserted`. A link the
// change reaches into goes entirely, so no link is ever left half edited.
// Typing right before or after a link leaves it alone.
export function replaceText(
  draft: Draft,
  start: number,
  end: number,
  inserted: string,
): { draft: Draft; caret: number } {
  let from = start;
  let to = end;
  for (const link of draft.links) {
    const touched =
      start === end
        ? link.start < start && start < link.end
        : start < link.end && end > link.start;
    if (touched) {
      from = Math.min(from, link.start);
      to = Math.max(to, link.end);
    }
  }

  const shift = inserted.length - (to - from);
  const links = draft.links
    .filter((link) => link.end <= from || link.start >= to)
    .map((link) =>
      link.start >= to
        ? { ...link, start: link.start + shift, end: link.end + shift }
        : link,
    );
  return {
    draft: {
      text: draft.text.slice(0, from) + inserted + draft.text.slice(to),
      links,
    },
    caret: from + inserted.length,
  };
}

// The part of the draft from `start` to `end`, keeping the links wholly
// inside it. A link only partly inside becomes plain text.
export function sliceDraft(draft: Draft, start: number, end: number): Draft {
  return {
    text: draft.text.slice(start, end),
    links: draft.links
      .filter((link) => link.start >= start && link.end <= end)
      .map((link) => ({
        ...link,
        start: link.start - start,
        end: link.end - start,
      })),
  };
}

// Puts `piece` (text with its own links, such as a picked link or a paste) in
// place of the draft's text from `start` to `end`
export function insertDraft(
  draft: Draft,
  start: number,
  end: number,
  piece: Draft,
): { draft: Draft; caret: number } {
  const { draft: next, caret } = replaceText(draft, start, end, piece.text);
  const at = caret - piece.text.length;
  const added = piece.links.map((link) => ({
    ...link,
    start: link.start + at,
    end: link.end + at,
  }));
  return {
    draft: {
      text: next.text,
      links: [...next.links, ...added].sort((a, b) => a.start - b.start),
    },
    caret,
  };
}

// What changed between two versions of a text box's text: the text from
// `start` to `end` in `before` became `inserted`. The caret, which sits just
// after what was typed or pasted, settles where a repeated letter went.
export function findChange(
  before: string,
  after: string,
  caret: number,
): { start: number; end: number; inserted: string } {
  const unchangedAfter = after.length - caret;
  let end = before.length - unchangedAfter;
  let insertedEnd = caret;
  if (end < 0 || before.slice(end) !== after.slice(caret)) {
    // The text after the caret changed too, so compare the two ends instead
    let same = 0;
    const most = Math.min(before.length, after.length);
    while (
      same < most &&
      before[before.length - 1 - same] === after[after.length - 1 - same]
    ) {
      same++;
    }
    end = before.length - same;
    insertedEnd = after.length - same;
  }

  let start = 0;
  const most = Math.min(end, insertedEnd);
  while (start < most && before[start] === after[start]) start++;
  return { start, end, inserted: after.slice(start, insertedEnd) };
}
