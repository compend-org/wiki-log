"use client";

import { useRouter } from "next/navigation";
// ABOUTME: The picker in settings for the language the site is shown in.
// ABOUTME: Saves the choice as a cookie, then reloads the page's content in that language.
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/app/localeActions";
import FlagPicker from "@/components/settings/FlagPicker";
import { LOCALES, siteLocaleOf } from "@/lib/locales";

export default function LocalePicker() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <FlagPicker
      options={LOCALES}
      value={siteLocaleOf(locale) ?? "en"}
      showNames
      label={t("settings.language.title")}
      onChange={(code) => {
        startTransition(async () => {
          await setLocale(code);
          router.refresh();
        });
      }}
    />
  );
}
