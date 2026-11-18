// ABOUTME: The text box for a list item's note, with a character count under it.
// ABOUTME: Text past the limit is kept, and the count turns red and says how much to cut.
"use client";

import {
  MAX_NOTE_LENGTH,
  noteLength,
  noteProblem,
} from "@/lib/lists/listNotes";

export default function NoteField({
  label,
  value,
  onChange,
  placeholder,
  autoFocus = false,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  rows?: number;
}) {
  const problem = noteProblem(value);
  return (
    <div className="flex flex-col gap-1">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        aria-invalid={problem !== null}
        placeholder={placeholder}
        rows={rows}
        // biome-ignore lint/a11y/noAutofocus: opened by the user to write a note
        autoFocus={autoFocus}
        className="max-h-[30vh] w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-base text-foreground sm:max-h-none sm:resize-y"
      />
      <p
        aria-live="polite"
        className={`flex justify-end gap-2 text-xs ${
          problem ? "text-danger" : "text-muted"
        }`}
      >
        {problem && <span>{problem}</span>}
        <span>
          {noteLength(value.trim()).toLocaleString("en-US")} / {MAX_NOTE_LENGTH}
        </span>
      </p>
    </div>
  );
}
