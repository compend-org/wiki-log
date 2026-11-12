"use client";

import { useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";
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

// The stored choice only changes through this setting, so there is nothing to
// listen for
function subscribeToNothing(): () => void {
  return () => {};
}

export default function ThemeSetting() {
  // The stored choice is read while rendering in the browser, so it shows
  // from the first paint. The server can't see it, so there neither option is
  // picked.
  const stored = useSyncExternalStore<ThemePref | null>(
    subscribeToNothing,
    getStoredTheme,
    () => null,
  );
  const [chosen, setChosen] = useState<ThemePref | null>(null);
  const pref = chosen ?? stored;

  function choose(next: ThemePref) {
    track("theme_changed", { theme: next });
    setChosen(next);
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
