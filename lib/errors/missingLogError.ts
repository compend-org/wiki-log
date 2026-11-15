// ABOUTME: Recognizes a like or share that failed because its review was deleted.
// ABOUTME: Shared by the buttons that explain it and the reporter that skips it.

export function isMissingLogError(
  error: { code?: string; message: string },
  table: "likes" | "shares",
): boolean {
  return (
    error.code === "23503" &&
    error.message.includes(`foreign key constraint "${table}_log_id_fkey"`)
  );
}
