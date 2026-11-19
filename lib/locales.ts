// ABOUTME: The languages the site itself can be shown in, and which one a visitor gets.
// ABOUTME: Separate from lib/languages.ts, which lists the Wikipedia languages items can be searched in.

export const LOCALES = [
  { code: "en", label: "English", flag: "gb" },
  { code: "es", label: "Español", flag: "es" },
  { code: "pt-BR", label: "Português (Brasil)", flag: "br" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

const DEFAULT_LOCALE: Locale = "en";

// The cookie that remembers a visitor's choice
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string | undefined | null): value is Locale {
  return LOCALES.some((l) => l.code === value);
}

// The first language in an Accept-Language header that the site has, matching
// on its main part so "es-MX" gets Spanish and "pt-PT" gets Brazilian Portuguese
function fromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const wanted = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return {
        tag: tag.trim().toLowerCase(),
        q: q ? Number(q.trim().slice(2)) : 1,
        index,
      };
    })
    .filter((w) => w.tag !== "" && w.tag !== "*" && w.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { tag } of wanted) {
    const exact = LOCALES.find((l) => l.code.toLowerCase() === tag);
    if (exact) return exact.code;
    const main = tag.split("-")[0];
    const sameMain = LOCALES.find(
      (l) => l.code.toLowerCase().split("-")[0] === main,
    );
    if (sameMain) return sameMain.code;
  }
  return null;
}

// A saved choice wins, then the browser's language, then English
export function pickLocale(
  cookie: string | undefined | null,
  acceptLanguage: string | null | undefined,
): Locale {
  if (isLocale(cookie)) return cookie;
  return fromAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}

// The site's language a locale tag belongs to: "es-MX" is Spanish and
// "pt-PT" is Brazilian Portuguese. Null for a language the site doesn't have.
export function siteLocaleOf(tag: string): Locale | null {
  const lower = tag.toLowerCase();
  const exact = LOCALES.find((l) => l.code.toLowerCase() === lower);
  if (exact) return exact.code;
  const main = lower.split("-")[0];
  return (
    LOCALES.find((l) => l.code.toLowerCase().split("-")[0] === main)?.code ??
    null
  );
}

// The countries that write dates month first (11/20/2026); everywhere else
// is day first (20/11/2026)
const MONTH_FIRST_COUNTRIES = new Set(["US", "CA", "PH"]);

// The locale to write dates and numbers in. English is day first (en-GB),
// and month first (en-US) for visitors in the countries above, as the hosting
// reports where the request came from (`country`, such as "US"). Spanish and
// Portuguese are day first.
export function formatLocale(
  site: Locale,
  country: string | null | undefined,
): string {
  if (site !== "en") return site;
  return MONTH_FIRST_COUNTRIES.has(country?.toUpperCase() ?? "")
    ? "en-US"
    : "en-GB";
}
