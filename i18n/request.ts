// ABOUTME: Tells next-intl which language and messages a request gets.
// ABOUTME: The language comes from the visitor's saved choice, else their browser, else English.
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, pickLocale } from "@/lib/locales";

export default getRequestConfig(async () => {
  const locale = pickLocale(
    (await cookies()).get(LOCALE_COOKIE)?.value,
    (await headers()).get("accept-language"),
  );
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
