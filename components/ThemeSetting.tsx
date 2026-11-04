"use client";

import { useEffect, useState } from "react";
import {
  applyTheme,
  getStoredTheme,
  setStoredTheme,
  type ThemePref,
} from "@/lib/theme";

const OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function ThemeSetting() {
  const [pref, setPref] = useState<ThemePref>("light");

  useEffect(() => {
    setPref(getStoredTheme());
  }, []);

  function choose(next: ThemePref) {
    setPref(next);
    setStoredTheme(next);
    applyTheme(next);
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
        Appearance
      </legend>
      {OPTIONS.map((o) => (
        <label key={o.value} className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="theme"
            value={o.value}
            checked={pref === o.value}
            onChange={() => choose(o.value)}
          />
          {o.label}
        </label>
      ))}
      <p className="text-xs text-muted">Saved on this device.</p>
    </fieldset>
  );
}
