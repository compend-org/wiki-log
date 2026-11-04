export function commentLabel(n: number): string {
  return n === 0 ? "Comment" : `${n} ${n === 1 ? "comment" : "comments"}`;
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
