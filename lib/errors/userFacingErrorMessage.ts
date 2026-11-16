// ABOUTME: Picks the message to show people when a Supabase request fails.
// ABOUTME: Keeps the messages written for people and hides the rest, which can name tables and columns.

// The database's own checks raise their messages for people with this code
const OWN_MESSAGE_CODE = "P0001";

// These are raised for people with 42501, which the database also uses for
// its permission errors that name tables, so only these are let through
const OWN_PERMISSION_MESSAGES = new Set([
  "Your account is suspended",
  "You can only report as yourself",
]);

export const SAVE_FAILED = "Couldn't save that. Please try again.";
export const LOAD_FAILED = "Couldn't load this. Please try again later.";

// What to show for a failed database request: a message the database raised
// for people, or else `fallback`
export function userFacingErrorMessage(
  error: { code?: string; message: string },
  fallback: string,
): string {
  if (error.code === OWN_MESSAGE_CODE) return error.message;
  if (error.code === "42501" && OWN_PERMISSION_MESSAGES.has(error.message)) {
    return error.message;
  }
  return fallback;
}

// What to show for a failed sign-in, sign-up or account request. Supabase
// writes these messages for people, except when its server or the database
// fails, or the request never reached it (status 0 or none), when they say
// what failed inside; those show `fallback`.
export function authMessage(
  error: { status?: number; message: string },
  fallback: string,
): string {
  if ((error.status || 500) >= 500 || /database error/i.test(error.message)) {
    return fallback;
  }
  return error.message;
}

// What to show when loading failed, or "" when nothing failed
export function loadMessage(
  error: { code?: string; message: string } | null | undefined,
): string {
  return error ? userFacingErrorMessage(error, LOAD_FAILED) : "";
}
