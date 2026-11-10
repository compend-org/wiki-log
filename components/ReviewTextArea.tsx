"use client";

import { useLayoutEffect, useRef, useState } from "react";
import ItemPicker from "@/components/ItemPicker";
import PersonPicker from "@/components/PersonPicker";
import { LINK_COLOR } from "@/components/ReviewText";
import {
  findChange,
  insertLink,
  replaceText,
  toDraft,
  toStored,
} from "@/lib/draftText";
import { mentionToken } from "@/lib/format";

// What you type to link to an item, and to mention a person
const LINK_TRIGGER = "::link";
const MENTION_TRIGGER = "@";

// Which search is open, and where its trigger sits in the shown text
type Picking = { kind: "item" | "person"; at: number; trigger: string };

// What gets stored in the review text for a link to an item
function linkToken(id: string, title: string): string {
  const clean =
    title
      .replace(/[[\]|]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200) || "item";
  return `[[${id}|${clean}]]`;
}

// A review box where typing ::link opens a search to pick an item to link to,
// and typing @ at the start of a word opens one to pick a person to mention.
// `value` is the stored text, with links as tokens. The box shows each link
// by its label, coloured like a link, and an edit that reaches into a link
// removes the whole link.
export default function ReviewTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  maxLength = 5000,
  className = "",
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  className?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const [picking, setPicking] = useState<Picking | null>(null);
  const [notice, setNotice] = useState<string>("");

  // Focuses the box when it opens, with the caret after any prefilled text.
  // React fills a new textarea through defaultValue, which leaves the caret
  // at the start, so it's moved to the end here.
  useLayoutEffect(() => {
    const box = ref.current;
    if (!autoFocus || !box) return;
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }, [autoFocus]);

  const draft = toDraft(value);

  // Puts the caret at `caret` once the box shows the latest text
  function placeCaret(caret: number) {
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(caret, caret);
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const shown = e.target.value;
    const shownCaret = e.target.selectionStart;
    const change = findChange(draft.text, shown, shownCaret);
    // Like a text box's maxLength, but counting the text as it's stored
    const room =
      maxLength -
      toStored(replaceText(draft, change.start, change.end, "").draft).length;
    const inserted = change.inserted.slice(0, Math.max(0, room));
    const { draft: next, caret } = replaceText(
      draft,
      change.start,
      change.end,
      inserted,
    );

    onChange(toStored(next));
    setNotice("");
    if (next.text !== shown || caret !== shownCaret) placeCaret(caret);

    // Only typing (not deleting) opens a search
    if (inserted.length === 0) return;
    const before = next.text.slice(0, caret);
    if (before.endsWith(LINK_TRIGGER)) {
      setPicking({
        kind: "item",
        at: caret - LINK_TRIGGER.length,
        trigger: LINK_TRIGGER,
      });
    } else if (/(^|\s)@$/.test(before)) {
      setPicking({
        kind: "person",
        at: caret - MENTION_TRIGGER.length,
        trigger: MENTION_TRIGGER,
      });
    }
  }

  function close() {
    setPicking(null);
    ref.current?.focus();
  }

  function insert(token: string) {
    if (!picking) return;
    // Swap the typed trigger for the token, or add the token at the end if
    // the trigger is no longer where it was typed
    const { at, trigger } = picking;
    const inPlace = draft.text.slice(at, at + trigger.length) === trigger;
    const start = inPlace ? at : draft.text.length;
    const end = inPlace ? at + trigger.length : start;
    const { draft: next, caret } = insertLink(draft, start, end, token);
    const stored = toStored(next);

    if (stored.length > maxLength) {
      setNotice(
        picking.kind === "item"
          ? "There isn't room for that link in the review."
          : "There isn't room for that mention.",
      );
      setPicking(null);
      return;
    }

    onChange(stored);
    setPicking(null);
    placeCaret(caret);
  }

  // The shown text with its links coloured, drawn behind the box's own
  // see-through text so the two line up exactly
  const coloured: React.ReactNode[] = [];
  let last = 0;
  for (const link of draft.links) {
    coloured.push(draft.text.slice(last, link.start));
    coloured.push(
      <span key={link.start} className={LINK_COLOR}>
        {draft.text.slice(link.start, link.end)}
      </span>,
    );
    last = link.end;
  }
  coloured.push(draft.text.slice(last));
  // A line break at the very end only takes up a line once something follows
  if (draft.text.endsWith("\n")) coloured.push(" ");

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <div
          ref={backdrop}
          aria-hidden
          className={`${className} pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words [scrollbar-gutter:stable]`}
        >
          {coloured}
        </div>
        <textarea
          ref={ref}
          value={draft.text}
          onChange={handleChange}
          onScroll={(e) => {
            if (backdrop.current) {
              backdrop.current.scrollTop = e.currentTarget.scrollTop;
            }
          }}
          rows={rows}
          placeholder={placeholder}
          className={`${className} relative block w-full bg-transparent! text-transparent! caret-foreground [scrollbar-gutter:stable]`}
        />
      </div>
      {picking && (
        // biome-ignore lint/a11y/noStaticElementInteractions: Escape from the picker inside closes it
        <div
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
          className="flex flex-col gap-2 border border-dashed border-line bg-surface p-2"
        >
          <span className="text-xs text-muted">
            {picking.kind === "item"
              ? "Pick an item to link to (Esc to cancel)"
              : "Pick a person to mention (Esc to cancel)"}
          </span>
          {picking.kind === "item" ? (
            <ItemPicker
              autoFocus
              placeholder="Search for an item to link…"
              onPick={(id, hit) => insert(linkToken(id, hit.title))}
            />
          ) : (
            <PersonPicker
              autoFocus
              placeholder="Search for a person to mention…"
              onPick={(p) => insert(mentionToken(p.id, p.username))}
            />
          )}
        </div>
      )}
      {notice && <p className="text-sm text-danger">{notice}</p>}
    </div>
  );
}
