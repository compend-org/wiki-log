// Who gets the admin badge
const ids = new Set(
  (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

// For server components only: this variable doesn't exist in the browser
export function isAdmin(userId: string | null | undefined): boolean {
  return Boolean(userId) && ids.has(userId as string);
}
