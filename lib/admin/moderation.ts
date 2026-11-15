// ABOUTME: The reasons people report posts and moderators act for, and what a moderator's form sends.
// ABOUTME: Shared by the report form, the moderation buttons and the server actions that check their input.

export const REPORT_REASONS = [
  { value: "spam", label: "Spam or advertising" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "hate", label: "Hateful content" },
  { value: "sexual", label: "Sexual or graphic content" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export const SUSPENSION_DAYS = [1, 3, 7, 30] as const;

// What a moderator fills in before acting. Which fields matter depends on the
// action: a suspension needs days, a removal needs a reason.
export type ModerationInput = {
  reason?: string;
  days?: number;
  note?: string;
};

export function isReportReason(value: unknown): value is ReportReason {
  return REPORT_REASONS.some((r) => r.value === value);
}

// The note with surrounding space removed, or null when there isn't one
export function cleanNote(note: unknown): string | null {
  if (typeof note !== "string") return null;
  const trimmed = note.trim().slice(0, 1000);
  return trimmed || null;
}
