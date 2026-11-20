// ABOUTME: The text box for a list item's note, with formatting and a character count under it.
// ABOUTME: Text past the limit is kept, and the count turns red and says how much to cut.
"use client";

import { useFormatter } from "next-intl";
import ReviewTextarea from "@/components/logs/ReviewTextArea";
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
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  rows?: number;
  // While the note is saving, so what's sent is what's shown
  readOnly?: boolean;
}) {
  const format = useFormatter();
  const problem = noteProblem(value);
  return (
    <div className="flex flex-col gap-1">
      <ReviewTextarea
        value={value}
        onChange={onChange}
        label={label}
        invalid={problem !== null}
        placeholder={placeholder}
        rows={rows}
        readOnly={readOnly}
        autoFocus={autoFocus}
        mentions={false}
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
          {format.number(noteLength(value.trim()))} / {MAX_NOTE_LENGTH}
        </span>
      </p>
    </div>
  );
}
