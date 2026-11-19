"use client";

// ABOUTME: A button showing the current language's flag that opens a grid of flags to pick from.
// ABOUTME: Used for the search language and for the language the site is shown in.
import { useState } from "react";

export type FlagOption = { code: string; label: string; flag: string };

export default function FlagPicker({
  options,
  value,
  onChange,
  label,
  columns = 6,
  showNames = false,
}: {
  options: readonly FlagOption[];
  value: string;
  onChange: (code: string) => void;
  // Names what is being picked, for screen readers: "Search language"
  label: string;
  columns?: number;
  // Writes each language's name beside its flag and lists them in one column
  showNames?: boolean;
}) {
  const [open, setOpen] = useState<boolean>(false);
  const current = options.find((o) => o.code === value) ?? options[0];

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
        aria-label={`${label}: ${current.label}`}
        title={current.label}
        className={`flex items-center gap-2 border border-line bg-surface px-2 hover:border-accent ${
          showNames ? "py-2" : "h-full gap-1"
        }`}
      >
        <span className={`fi fi-${current.flag} text-lg`} />
        {showNames && <span className="text-sm">{current.label}</span>}
        <span aria-hidden="true" className="text-xs text-muted">
          ▾
        </span>
      </button>

      {open && (
        <div
          className={`absolute top-full z-[16] mt-1 border border-line bg-background p-2 ${
            showNames
              ? "left-0 flex min-w-full flex-col gap-1"
              : "right-0 grid w-max gap-1"
          }`}
          style={
            showNames
              ? undefined
              : { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
          }
        >
          {options.map((o) => (
            <button
              key={o.code}
              type="button"
              onClick={() => {
                onChange(o.code);
                setOpen(false);
              }}
              aria-label={o.label}
              title={o.label}
              className={`flex items-center p-1.5 hover:bg-surface ${
                showNames ? "gap-2 whitespace-nowrap" : "justify-center"
              } ${
                o.code === value
                  ? "bg-surface outline outline-1 outline-accent"
                  : ""
              }`}
            >
              <span className={`fi fi-${o.flag} text-xl`} />
              {showNames && <span className="text-sm">{o.label}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
