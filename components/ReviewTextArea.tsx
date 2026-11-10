"use client";

import { useLayoutEffect, useRef, useState } from "react";
import ItemPicker from "@/components/ItemPicker";

const TRIGGER = "::link";

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

// A review box where typing ::link opens a search to pick an item to link to
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
  const [picking, setPicking] = useState<boolean>(false);
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

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    const caret = e.target.selectionStart;
    onChange(next);
    setNotice("");
    if (next.slice(caret - TRIGGER.length, caret) === TRIGGER) {
      setPicking(true);
    }
  }

  function close() {
    setPicking(false);
    ref.current?.focus();
  }

  function insert(id: string, title: string) {
    const token = linkToken(id, title);
    // Swap the typed ::link for the link (the last one, in case of several)
    const at = value.lastIndexOf(TRIGGER);
    const next =
      at >= 0
        ? value.slice(0, at) + token + value.slice(at + TRIGGER.length)
        : value + token;

    if (next.length > maxLength) {
      setNotice("There isn't room for that link in the review.");
      setPicking(false);
      return;
    }

    onChange(next);
    setPicking(false);
    const caret = (at >= 0 ? at : value.length) + token.length;
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(caret, caret);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        maxLength={maxLength}
        rows={rows}
        placeholder={placeholder}
        className={className}
      />
      {picking && (
        // biome-ignore lint/a11y/noStaticElementInteractions: Escape from the picker inside closes it
        <div
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
          className="flex flex-col gap-2 border border-dashed border-line bg-surface p-2"
        >
          <span className="text-xs text-muted">
            Pick an item to link to (Esc to cancel)
          </span>
          <ItemPicker
            autoFocus
            placeholder="Search for an item to link…"
            onPick={(id, hit) => insert(id, hit.title)}
          />
        </div>
      )}
      {notice && <p className="text-sm text-danger">{notice}</p>}
    </div>
  );
}
