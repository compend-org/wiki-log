// ABOUTME: SFW mode: whether adult content is shown, blurred, or left out, and the one check
// ABOUTME: every list of posts goes through. The browser keeps a copy so CSS applies from first paint.

// "blur" blurs adult items' images; "hide" also leaves posts about them out
export type SfwMode = "off" | "blur" | "hide";

const SFW_MODES: SfwMode[] = ["off", "blur", "hide"];

// Anything that isn't a known mode reads as off
export function parseSfwMode(value: unknown): SfwMode {
  return SFW_MODES.includes(value as SfwMode) ? (value as SfwMode) : "off";
}

// The entries a viewer with this mode sees. In hide mode the ones about adult
// items are left out; otherwise all of them stay, and CSS blurs what it must.
export function shownEntries<T>(
  entries: T[],
  mode: SfwMode,
  isAdult: (entry: T) => boolean,
): T[] {
  return mode === "hide" ? entries.filter((e) => !isAdult(e)) : entries;
}

// True for a post, like a review, about an adult item
export function aboutAdultItem(post: { items: { nsfw: boolean } | null }) {
  return post.items?.nsfw ?? false;
}

// Commons and Wikipedia file categories that describe explicit pictures
export const EXPLICIT_CATEGORY =
  /\b(nude|nudes|nudity|naked|topless|erotic|erotica|pornograph\w*|genitalia|genitals|penis|penises|vulva|vulvas|vagina|vaginas|human sexual activity|sexual intercourse|sex acts?|sex positions?|sex toys?|intercourse|masturbation|fellatio|cunnilingus|anilingus|bdsm|hentai|nipples?)\b/i;

// The browser's copy of the account's mode, read before the first paint
const SFW_KEY = "sfw";

export function setStoredSfw(mode: SfwMode): void {
  try {
    if (mode === "off") localStorage.removeItem(SFW_KEY);
    else localStorage.setItem(SFW_KEY, mode);
  } catch {
    // Storage can be blocked; the page then catches up once the account loads
  }
}

// Fired on window whenever the page's mode changes
export const SFW_CHANGE_EVENT = "sfw-mode-change";

export function applySfw(mode: SfwMode): void {
  if (mode === currentSfwMode()) return;
  if (mode === "off") delete document.documentElement.dataset.sfw;
  else document.documentElement.dataset.sfw = mode;
  window.dispatchEvent(new Event(SFW_CHANGE_EVENT));
}

// The mode the page is in, for code running in the browser
export function currentSfwMode(): SfwMode {
  return parseSfwMode(document.documentElement.dataset.sfw);
}

// Runs in <head> before the first paint, so adult images never flash unblurred
export const sfwInitScript = `(function(){try{var m=localStorage.getItem("${SFW_KEY}");if(m==="blur"||m==="hide")document.documentElement.dataset.sfw=m;}catch(e){}})();`;
