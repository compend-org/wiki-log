// A rating out of 5 as plain text, like "★★★½". No rating gives "".
export function starText(rating: number | null | undefined): string {
  const clamped = Math.max(0, Math.min(5, rating ?? 0));
  const full = Math.floor(clamped);
  const half = clamped - full >= 0.5;
  // A lone half needs a star beside it to read as a rating
  if (full === 0) return half ? "½★" : "";
  return "★".repeat(full) + (half ? "½" : "");
}

export function commentLabel(n: number): string {
  return n === 0 ? "Comment" : `${n} ${n === 1 ? "comment" : "comments"}`;
}

// "Now" under a minute, "5m ago" or "2h ago" within the last day, and the
// date after that. A time slightly ahead of `now` counts as just now.
export function timeAgo(time: string, now: number): string {
  const date = new Date(time);
  const elapsed = Math.max(0, now - date.getTime());
  const minutes = Math.floor(elapsed / 60_000);
  const hours = Math.floor(minutes / 60);

  if (hours >= 24) return date.toLocaleDateString();
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Now";
}

// "54 (number)" becomes "54". If removing the brackets would leave nothing,
// the original title is kept.
function cleanTitle(title: string): string {
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

// The image an item may show: a hidden image counts as no image at all
export function shownImage(item: {
  image_url: string | null;
  image_hidden?: boolean;
}): string | null {
  return item.image_hidden ? null : item.image_url;
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

// The file's name, read from an upload.wikimedia.org address
export function fileNameFromUrl(url: string): string | null {
  try {
    const parts = new URL(absolute(url)).pathname.split("/").filter(Boolean);
    if (parts[0] !== "wikipedia") return null;
    const name = parts[2] === "thumb" ? parts[5] : parts[4];
    return name ? decodeURIComponent(name) : null;
  } catch {
    return null;
  }
}

// A file name the way wiki titles write it: spaces, first letter capitalised
export function fileTitle(name: string): string {
  const spaced = name.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Search suggestions only ever show images stored on Wikimedia Commons, whose
// licences allow reuse
export function freeImage(url: string | undefined | null): string | null {
  if (!url) return null;
  const full = absolute(url);
  return full.includes("/wikipedia/commons/") ? full : null;
}

// Links are stored inside review and comment text: to items as [[Q123|Title]],
// and to people (mentions) as [[@<their id>|username]]
export const REVIEW_LINK =
  /\[\[([QC]\d+|@[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\|([^\]|]{1,200})\]\]/g;

// What gets stored in the text for a mention of a person
export function mentionToken(id: string, username: string): string {
  return `[[@${id}|${username}]]`;
}

// A review as plain text, with each item link replaced by the item's title
// and each mention by @username
export function plainReview(text: string): string {
  return text.replace(REVIEW_LINK, (_, id: string, title: string) =>
    id.startsWith("@") ? `@${title}` : title,
  );
}
