"use client";

// ABOUTME: The picker for the language items are searched in, one flag per Wikipedia language.
// ABOUTME: Built on FlagPicker, which the site's own language picker uses as well.
import FlagPicker from "@/components/settings/FlagPicker";
import { LANGUAGES, type LangCode } from "@/lib/languages";

const FLAGS: Record<LangCode, string> = {
  en: "gb",
  de: "de",
  fr: "fr",
  es: "es",
  it: "it",
  pt: "pt",
  nl: "nl",
  sv: "se",
  pl: "pl",
  cs: "cz",
  sl: "si",
  hr: "hr",
  ru: "ru",
  uk: "ua",
  tr: "tr",
  ar: "sa",
  he: "il",
  fa: "ir",
  hi: "in",
  ja: "jp",
  ko: "kr",
  zh: "cn",
};

const OPTIONS = LANGUAGES.map((l) => ({
  code: l.code,
  label: l.label,
  flag: FLAGS[l.code],
}));

export default function LanguagePicker({
  value,
  onChange,
}: {
  value: LangCode;
  onChange: (lang: LangCode) => void;
}) {
  return (
    <FlagPicker
      options={OPTIONS}
      value={value}
      onChange={(code) => onChange(code as LangCode)}
      label="Search language"
    />
  );
}
