"use client";

// ABOUTME: The profile setting for SFW mode: off, blur adult images, or hide adult posts.
// ABOUTME: Saved to the account, and applied to this page as soon as it is chosen.

import { useState } from "react";
import { track } from "@/lib/analytics";
import { applySfw, type SfwMode, setStoredSfw } from "@/lib/sfw";
import { createClient } from "@/lib/supabase/client";
import { useLocalCopy } from "@/lib/useLocalCopy";

const OPTIONS: { value: SfwMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "blur", label: "Blur adult images" },
  { value: "hide", label: "Hide adult posts" },
];

export default function SfwSetting({
  userId,
  savedMode,
}: {
  userId: string;
  savedMode: SfwMode;
}) {
  const [mode, setMode] = useLocalCopy(savedMode);
  const [error, setError] = useState("");
  // Choices wait while one is saving
  const [busy, setBusy] = useState(false);

  async function choose(next: SfwMode) {
    const before = mode;
    track("sfw_mode_changed", { mode: next });
    setMode(next);
    setStoredSfw(next);
    applySfw(next);
    setError("");
    setBusy(true);

    const { error: saveError } = await createClient()
      .from("user_settings")
      .upsert({ user_id: userId, sfw_mode: next });
    if (saveError) {
      setMode(before);
      setStoredSfw(before);
      applySfw(before);
      setError("Couldn't save that. Try again.");
      setBusy(false);
      return;
    }
    // A full reload, because pages kept open in the background hold on to
    // the posts they were first drawn with
    window.location.reload();
  }

  return (
    <fieldset disabled={busy} className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
        SFW mode
      </legend>
      {OPTIONS.map((o) => (
        <label key={o.value} className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="sfw"
            value={o.value}
            checked={mode === o.value}
            onChange={() => choose(o.value)}
          />
          {o.label}
        </label>
      ))}
      {error && <p className="text-sm text-danger">{error}</p>}
    </fieldset>
  );
}
