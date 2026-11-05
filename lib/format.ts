export function commentLabel(n: number): string {
  return n === 0 ? "Comment" : `${n} ${n === 1 ? "comment" : "comments"}`;
}

// "alex shared", "alex and 2 others shared", "You shared"
export function sharedLabel(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} shared:`;
  const others = names.length - 1;
  return `${names[0]} and ${others} ${others === 1 ? "other" : "others"} shared:`;
}

// ".3s ago", "12s ago", "5m ago" or "2h ago" within the last day, and the date
// after that. A time slightly ahead of `now` counts as just now.
export function timeAgo(time: string, now: number): string {
  const date = new Date(time);
  const elapsed = Math.max(0, now - date.getTime());
  const minutes = Math.floor(elapsed / 60_000);
  const hours = Math.floor(minutes / 60);

  if (hours >= 24) return date.toLocaleDateString();
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  if (elapsed >= 1000)
    return `${Math.min(59, Math.round(elapsed / 1000))}s ago`;
  return `.${Math.min(9, Math.max(1, Math.round(elapsed / 100)))}s ago`;
}

// "54 (number)" becomes "54". If removing the brackets would leave nothing,
// the original title is kept.
export function cleanTitle(title: string): string {
  let out = title;
  let previous = "";
  while (out !== previous) {
    previous = out;
    out = out.replace(/\s*\([^()]*\)/g, "");
  }
  out = out.replace(/\s+/g, " ").trim();
  return out || title.trim();
}

// The text shown in an empty image box: no parentheticals, and cut off with an
// ellipsis after `max` characters (at a word boundary when there's one nearby)
export function shortLabel(title: string, max = 32): string {
  const text = cleanTitle(title);
  const chars = Array.from(text);
  if (chars.length <= max) return text;

  const cut = chars.slice(0, max - 1).join("");
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace >= max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}

// The first letter or digit of a title, capitalised. A title with neither is
// returned without its parentheticals.
export function firstLetter(title: string): string {
  const text = cleanTitle(title);
  return text.match(/[\p{L}\p{N}]/u)?.[0].toUpperCase() ?? text;
}

// A smaller version of a Wikimedia thumbnail address, for small boxes. Other
// addresses are returned unchanged.
export function thumbUrl(url: string, width = 330): string {
  const m = /^(.*\/thumb\/.*\/)(\d+)px-([^/]+)$/.exec(url);
  if (!m) return url;
  return Number(m[2]) > width ? `${m[1]}${width}px-${m[3]}` : url;
}

export function absolute(url: string): string {
  return url.startsWith("//") ? `https:${url}` : url;
}

// Search suggestions only ever show images stored on Wikimedia Commons, whose
// licences allow reuse
export function freeImage(url: string | undefined | null): string | null {
  if (!url) return null;
  const full = absolute(url);
  return full.includes("/wikipedia/commons/") ? full : null;
}
