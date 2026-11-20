import { isCompoundId } from "@/lib/ids";

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
// date after that, all in the language of `locale`. A time slightly ahead of `now` counts as just now.
export type AgoTranslator = (
  key: "time.now" | "time.minutesAgo" | "time.hoursAgo",
  values?: { minutes?: number; hours?: number },
) => string;

export function timeAgo(
  time: string,
  now: number,
  t: AgoTranslator,
  locale: string,
): string {
  const date = new Date(time);
  const elapsed = Math.max(0, now - date.getTime());
  const minutes = Math.floor(elapsed / 60_000);
  const hours = Math.floor(minutes / 60);

  if (hours >= 24) return date.toLocaleDateString(locale);
  if (hours > 0) return t("time.hoursAgo", { hours });
  if (minutes > 0) return t("time.minutesAgo", { minutes });
  return t("time.now");
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

// The text cut off with an ellipsis after `max` characters, at a word boundary
// when there's one nearby. Emoji and other multi-unit characters stay whole.
export function truncate(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;

  const cut = chars.slice(0, max - 1).join("");
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace >= max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}

// The text shown in an empty image box: no parentheticals, and cut off with an
// ellipsis after `max` characters (at a word boundary when there's one nearby)
export function shortLabel(title: string, max = 32): string {
  return truncate(cleanTitle(title), max);
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

// The picture a review or list entry shows: the one its author chose, or else
// its item's
export function entryPicture(entry: {
  image_url: string | null;
  items: { image_url: string | null; image_hidden?: boolean } | null;
}): string | null {
  return entry.image_url ?? (entry.items ? shownImage(entry.items) : null);
}

// The thumbnail widths Wikimedia serves; it refuses any other width
const THUMB_WIDTHS = [20, 40, 60, 120, 250, 330, 500, 960, 1280, 1920, 3840];

// A smaller version of a Wikimedia thumbnail address, for small boxes, at
// least as wide as asked. Other addresses are returned unchanged.
export function thumbUrl(url: string, width = 330): string {
  const m = /^(.*\/thumb\/.*\/)(\d+)px-([^/]+)$/.exec(url);
  const served = THUMB_WIDTHS.find((w) => w >= width);
  if (!m || !served) return url;
  return Number(m[2]) > served ? `${m[1]}${served}px-${m[3]}` : url;
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

// Review text is markdown, so a link to a web page is [words](https://…)
export const WEB_LINK = /\[([^[\]\n]+)\]\((https?:\/\/[^\s()]+)\)/g;

// The address typed or pasted for a link, made whole: https:// is added when
// it's missing. Null when it isn't the address of a web page.
export function webAddress(typed: string): string | null {
  const text = typed.trim();
  if (/\s/.test(text) || text === "") return null;
  const full = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  if (!URL.canParse(full)) return null;
  const url = new URL(full);
  return url.hostname.includes(".") ? full : null;
}

// What gets stored for a link to a web page. Brackets in the words and
// parentheses in the address would end the link early, so they're swapped
// for spaces and escaped.
export function webLinkToken(words: string, address: string): string {
  const clean =
    words
      .replace(/[[\]\n]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || address;
  const url = address.replace(/\(/g, "%28").replace(/\)/g, "%29");
  return `[${clean}](${url})`;
}

// An item's description as plain text. A compound's is written here, in
// markdown; the rest come from Wikipedia as plain text already.
export function plainItemDescription(id: string, description: string): string {
  return isCompoundId(id) ? plainReview(description) : description;
}

// A review as plain text: item links read as the item's title, mentions as
// @username, web links as their words, and markdown marks (and the $$ around
// TeX) are dropped
export function plainReview(text: string): string {
  return text
    .replace(REVIEW_LINK, (_, id: string, title: string) =>
      id.startsWith("@") ? `@${title}` : title,
    )
    .replace(WEB_LINK, "$1")
    .replace(/^ {0,3}(?:#{1,6}|>|[-*+]|\d+[.)])[ \t]+/gm, "")
    .replace(/(\*\*|__|~~)(?=\S)(.+?)\1/g, "$2")
    .replace(/(?<![\w*])([*_])([^\s*](?:.*?[^\s*])?)\1(?![\w*])/g, "$2")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\$\$\s*([^$]+?)\s*\$\$/g, "$1");
}
