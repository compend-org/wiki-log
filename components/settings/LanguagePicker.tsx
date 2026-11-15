"use client";

import { useState } from "react";
import { LANGUAGES, type LangCode } from "@/lib/languages";

// One flag per language. It isn't one-to-one, so change any of these.
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

export default function LanguagePicker({
  value,
  onChange,
}: {
  value: LangCode;
  onChange: (lang: LangCode) => void;
}) {
  const [open, setOpen] = useState<boolean>(false);
  const current = LANGUAGES.find((l) => l.code === value) ?? LANGUAGES[0];

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: closes the menu on events from the controls inside it
    <div
      className="relative flex"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`Search language: ${current.label}`}
        title={current.label}
        className="flex h-full items-center gap-1 border border-line bg-surface px-2 hover:border-accent"
      >
        <span className={`fi fi-${FLAGS[value]} text-lg`} />
        <span aria-hidden="true" className="text-xs text-muted">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[16] mt-1 grid w-max grid-cols-6 gap-1 border border-line bg-background p-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                onChange(l.code);
                setOpen(false);
              }}
              aria-label={l.label}
              title={l.label}
              className={`flex items-center justify-center p-1.5 hover:bg-surface ${
                l.code === value
                  ? "bg-surface outline outline-1 outline-accent"
                  : ""
              }`}
            >
              <span className={`fi fi-${FLAGS[l.code]} text-xl`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
