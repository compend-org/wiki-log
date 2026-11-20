"use client";

import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef, useState } from "react";
import ItemPicker from "@/components/items/ItemPicker";
import FormatBar from "@/components/logs/FormatBar";
import ReviewText, { LINK_COLOR } from "@/components/logs/ReviewText";
import PersonPicker from "@/components/people/PersonPicker";
import {
  type Draft,
  findChange,
  formatMarks,
  insertDraft,
  listEnter,
  replaceText,
  sliceDraft,
  toDraft,
  toggleMarker,
  toStored,
} from "@/lib/draftText";
import {
  mentionToken,
  shortLabel,
  webAddress,
  webLinkToken,
} from "@/lib/format";

// What you type to link to an item, and to mention a person
const LINK_TRIGGER = "::link";
const MENTION_TRIGGER = "@";

// Where a copy or cut puts the stored text, links and all, for a paste back
// into one of these boxes. Other apps get the text as shown.
const CLIPBOARD_TYPE = "application/x-compend-text";

// How markdown marks and bold text look while writing. Bold is drawn
// heavier with an outline, which keeps every letter the width of the box's own.
const MARK_STYLE = "text-muted/60";
const BOLD_STYLE = "[-webkit-text-stroke:0.4px_currentColor]";

// Which search is open, and where its trigger sits in the shown text; or the
// web address box, and the words it will link
type Picking =
  | { kind: "item" | "person"; at: number; trigger: string }
  | { kind: "web"; start: number; end: number };

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
// The text is markdown: a bar above the box, shown while it's in use, makes
// the selected text bold or italic or links it to a web page. `value` is the
// stored text, with links as tokens. The box shows each link by its label,
// coloured like a link, and an edit that reaches into a link removes the
// whole link.
export default function ReviewTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  maxLength = 5000,
  className = "",
  autoFocus = false,
  mentions = true,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  className?: string;
  autoFocus?: boolean;
  // Whether typing @ opens a search to mention a person
  mentions?: boolean;
  // For a label to point at
  id?: string;
}) {
  const t = useTranslations();
  const ref = useRef<HTMLTextAreaElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const [picking, setPicking] = useState<Picking | null>(null);
  const [notice, setNotice] = useState<string>("");
  // What's typed in the web address box
  const [address, setAddress] = useState<string>("");
  // The height of the box when the preview opened, so the preview takes up
  // the same space; null while writing
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);
  // An emptied box, as after posting, goes back to writing
  if (previewHeight !== null && !value) setPreviewHeight(null);

  // Focuses the box when it opens, with the caret after any prefilled text.
  // React fills a new textarea through defaultValue, which leaves the caret
  // at the start, so it's moved to the end here.
  useLayoutEffect(() => {
    const box = ref.current;
    if (!autoFocus || !box) return;
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }, [autoFocus]);

  // Where the caret goes once the box shows the latest text
  const pendingCaret = useRef<{ start: number; end: number } | null>(null);
  function movePendingCaret() {
    const box = ref.current;
    const at = pendingCaret.current;
    if (!box || !at) return;
    pendingCaret.current = null;
    box.focus();
    box.setSelectionRange(at.start, at.end);
  }
  // Right as the new text shows, before the next key press lands
  useLayoutEffect(movePendingCaret);

  const draft = toDraft(value);

  // Puts the caret at `caret`, or selects up to `end`, once the box shows the
  // latest text. When the text stays the same, nothing redraws, so the caret
  // moves on the next frame instead.
  function placeCaret(caret: number, end = caret) {
    pendingCaret.current = { start: caret, end };
    requestAnimationFrame(movePendingCaret);
  }

  // Shows `next` with the caret at `caret`
  function apply({ draft: next, caret }: { draft: Draft; caret: number }) {
    onChange(toStored(next));
    setNotice("");
    placeCaret(caret);
  }

  // Puts the selection on the clipboard, links and all. Returns what was
  // copied, or null when nothing is selected.
  function copySelection(
    e: React.ClipboardEvent<HTMLTextAreaElement>,
  ): { start: number; end: number } | null {
    const { selectionStart: start, selectionEnd: end } = e.currentTarget;
    if (start === end) return null;
    e.preventDefault();
    e.clipboardData.setData("text/plain", draft.text.slice(start, end));
    e.clipboardData.setData(
      CLIPBOARD_TYPE,
      toStored(sliceDraft(draft, start, end)),
    );
    return { start, end };
  }

  function handleCut(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const copied = copySelection(e);
    if (copied) apply(replaceText(draft, copied.start, copied.end, ""));
  }

  // Text copied from one of these boxes pastes back with its links, and a web
  // address pasted over selected text links that text to it. Anything else,
  // or a paste too long to fit, pastes as plain text.
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const { selectionStart: start, selectionEnd: end } = e.currentTarget;
    const stored = e.clipboardData.getData(CLIPBOARD_TYPE);
    if (!stored) {
      const pasted = e.clipboardData.getData("text/plain").trim();
      const url = /^https?:\/\//i.test(pasted) ? webAddress(pasted) : null;
      if (start === end || !url) return;
      e.preventDefault();
      putLink(
        start,
        end,
        webLinkToken(draft.text.slice(start, end), url),
        t("errors.linkNoRoom"),
      );
      return;
    }
    const pasted = insertDraft(draft, start, end, toDraft(stored));
    if (toStored(pasted.draft).length > maxLength) return;
    e.preventDefault();
    apply(pasted);
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
    const stored = toStored(next);
    // A web link typed out in full, [words](address), shrinks to its words,
    // so the caret moves back by what's hidden
    const shownNext = toDraft(stored).text;
    const shownNextCaret = caret - (next.text.length - shownNext.length);

    onChange(stored);
    setNotice("");
    if (shownNext !== shown || shownNextCaret !== shownCaret) {
      placeCaret(shownNextCaret);
    }

    // Only typing (not deleting) opens a search
    if (inserted.length === 0) return;
    const before = next.text.slice(0, caret);
    if (before.endsWith(LINK_TRIGGER)) {
      setPicking({
        kind: "item",
        at: caret - LINK_TRIGGER.length,
        trigger: LINK_TRIGGER,
      });
    } else if (mentions && /(^|\s)@$/.test(before)) {
      setPicking({
        kind: "person",
        at: caret - MENTION_TRIGGER.length,
        trigger: MENTION_TRIGGER,
      });
    }
  }

  // Enter on a list item starts the next one, or ends the list on an empty
  // one. Ctrl or Cmd with B or I makes the selected text bold or italic.
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const box = e.currentTarget;
    const plainEnter =
      e.key === "Enter" &&
      !(e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) &&
      !e.nativeEvent.isComposing &&
      box.selectionStart === box.selectionEnd;
    if (plainEnter) {
      const next = listEnter(draft, box.selectionStart);
      if (!next || toStored(next.draft).length > maxLength) return;
      e.preventDefault();
      apply(next);
      return;
    }
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
    const key = e.key.toLowerCase();
    if (key !== "b" && key !== "i") return;
    e.preventDefault();
    mark(key === "b" ? "**" : "*");
  }

  // Makes the selected text bold (**) or italic (*), or plain again
  function mark(marker: "**" | "*") {
    const box = ref.current;
    if (!box) return;
    const marked = toggleMarker(
      draft,
      box.selectionStart,
      box.selectionEnd,
      marker,
    );
    const stored = toStored(marked.draft);
    if (stored.length > maxLength) return;
    onChange(stored);
    setNotice("");
    placeCaret(marked.start, marked.end);
  }

  // Opens the web address box, to link the selected text
  function openWebLink() {
    const box = ref.current;
    if (!box) return;
    setAddress("");
    setNotice("");
    setPicking({
      kind: "web",
      start: box.selectionStart,
      end: box.selectionEnd,
    });
  }

  // Links the selected text to the typed address, or puts the address in on
  // its own when no text was selected
  function addWebLink() {
    if (picking?.kind !== "web") return;
    const url = webAddress(address);
    if (!url) {
      setNotice(t("logs.format.badAddress"));
      return;
    }
    const words = draft.text.slice(picking.start, picking.end);
    putLink(
      picking.start,
      picking.end,
      words.trim() ? webLinkToken(words, url) : url,
      t("errors.linkNoRoom"),
    );
  }

  // Switches between writing and the preview of the post as it will look
  function togglePreview() {
    if (previewHeight !== null) {
      setPreviewHeight(null);
      placeCaret(ref.current?.selectionStart ?? 0, ref.current?.selectionEnd);
      return;
    }
    setPicking(null);
    setNotice("");
    setPreviewHeight(ref.current?.getBoundingClientRect().height ?? 0);
  }

  function close() {
    setPicking(null);
    ref.current?.focus();
  }

  function insert(token: string) {
    if (!picking || picking.kind === "web") return;
    // Swap the typed trigger for the token, or add the token at the end if
    // the trigger is no longer where it was typed
    const { at, trigger } = picking;
    const inPlace = draft.text.slice(at, at + trigger.length) === trigger;
    const start = inPlace ? at : draft.text.length;
    const end = inPlace ? at + trigger.length : start;
    putLink(
      start,
      end,
      token,
      picking.kind === "item"
        ? t("errors.linkNoRoom")
        : t("errors.mentionNoRoom"),
    );
  }

  // Puts `token` in place of the shown text from `start` to `end`, or says
  // `noRoom` when the text would grow too long
  function putLink(start: number, end: number, token: string, noRoom: string) {
    const { draft: next, caret } = insertDraft(
      draft,
      start,
      end,
      toDraft(token),
    );
    const stored = toStored(next);
    setPicking(null);

    if (stored.length > maxLength) {
      setNotice(noRoom);
      return;
    }

    onChange(stored);
    placeCaret(caret);
  }

  // The shown text drawn behind the box's own see-through text, so the two
  // line up exactly: links coloured, markdown marks faint, bold text heavier
  const styles: (string | undefined)[] = new Array(draft.text.length);
  for (const m of formatMarks(draft.text)) {
    styles.fill(m.kind === "bold" ? BOLD_STYLE : MARK_STYLE, m.start, m.end);
  }
  for (const link of draft.links) styles.fill(LINK_COLOR, link.start, link.end);
  const coloured: React.ReactNode[] = [];
  let last = 0;
  for (let i = 1; i <= draft.text.length; i++) {
    if (i < draft.text.length && styles[i] === styles[last]) continue;
    const piece = draft.text.slice(last, i);
    coloured.push(
      styles[last] ? (
        <span key={last} className={styles[last]}>
          {piece}
        </span>
      ) : (
        piece
      ),
    );
    last = i;
  }
  // A line break at the very end only takes up a line once something follows
  if (draft.text.endsWith("\n")) coloured.push(" ");

  return (
    <div className="flex flex-col gap-2">
      <div>
        {previewHeight !== null && (
          <div
            style={{ minHeight: previewHeight }}
            className={`${className} break-words`}
          >
            <ReviewText text={value} plain />
          </div>
        )}
        <div className={previewHeight === null ? "relative" : "hidden"}>
          <div
            ref={backdrop}
            aria-hidden
            className={`${className} pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words [scrollbar-gutter:stable]`}
          >
            {coloured}
          </div>
          <textarea
            id={id}
            ref={ref}
            value={draft.text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onCopy={copySelection}
            onCut={handleCut}
            onPaste={handlePaste}
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
        <FormatBar
          onBold={() => mark("**")}
          onItalic={() => mark("*")}
          onLink={openWebLink}
          previewing={previewHeight !== null}
          onPreview={togglePreview}
          canPreview={value.trim() !== ""}
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
            {picking.kind === "web"
              ? picking.start === picking.end
                ? t("logs.format.linkAddress")
                : t("logs.format.linkWords", {
                    words: shortLabel(
                      draft.text.slice(picking.start, picking.end),
                    ),
                  })
              : picking.kind === "item"
                ? t("logs.mention.pickItem")
                : t("logs.mention.pickPerson")}
          </span>
          {picking.kind === "web" ? (
            <>
              <input
                type="url"
                inputMode="url"
                autoComplete="off"
                // biome-ignore lint/a11y/noAutofocus: the address box opens to be typed in
                autoFocus
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setNotice("");
                }}
                onKeyDown={(e) => {
                  // Enter adds the link, rather than sending the form around it
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  addWebLink();
                }}
                placeholder="https://…"
                aria-label={t("logs.format.linkTitle")}
                className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-foreground"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addWebLink}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm text-background"
                >
                  {t("logs.format.addLink")}
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </>
          ) : picking.kind === "item" ? (
            <ItemPicker
              autoFocus
              placeholder={t("logs.mention.searchItem")}
              onPick={(id, hit) => insert(linkToken(id, hit.title))}
            />
          ) : (
            <PersonPicker
              autoFocus
              placeholder={t("logs.mention.searchPerson")}
              onPick={(p) => insert(mentionToken(p.id, p.username))}
            />
          )}
        </div>
      )}
      {notice && <p className="text-sm text-danger">{notice}</p>}
    </div>
  );
}
