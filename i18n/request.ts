// ABOUTME: Tells next-intl which language and messages a request gets.
// ABOUTME: The language comes from the visitor's saved choice, else their browser, else English.
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { formatLocale, LOCALE_COOKIE, pickLocale } from "@/lib/locales";

export default getRequestConfig(async () => {
  const acceptLanguage = (await headers()).get("accept-language");
  const site = pickLocale(
    (await cookies()).get(LOCALE_COOKIE)?.value,
    acceptLanguage,
  );
  return {
    // The language with how dates are written, such as "en-GB" for day first
    // and "en-US" for month first, by the visitor's country. The messages are the site language's.
    locale: formatLocale(site, (await headers()).get("x-vercel-ip-country")),
    messages: (await import(`../messages/${site}.json`)).default,
  };
});
