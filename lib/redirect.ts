// Only paths on this site are allowed: "/item/Q89" yes, "https://elsewhere.com"
// and "//elsewhere.com" no.
export function safeNext(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || /[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}

// The address of the login page that returns to `next` afterwards
export function loginHref(next: string): string {
  const safe = safeNext(next, "/");
  if (safe === "/" || safe.startsWith("/login")) return "/login";
  return `/login?next=${encodeURIComponent(safe)}`;
}
