"use client";

// ABOUTME: Keeps the page's lang attribute in step with the language the site is shown in.
// ABOUTME: The root layout is prerendered before a visitor's language is known, so this sets it once in the browser.
import { useLocale } from "next-intl";
import { useEffect } from "react";

export default function HtmlLang() {
  const locale = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
