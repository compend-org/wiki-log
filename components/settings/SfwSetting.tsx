"use client";

// ABOUTME: The profile setting for SFW mode: off, blur adult images, or hide adult posts.
// ABOUTME: Saved to the account, and applied to this page as soon as it is chosen.

import { useTranslations } from "next-intl";
import { useState } from "react";
import { track } from "@/lib/analytics/analytics";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import { applySfw, type SfwMode, setStoredSfw } from "@/lib/sfw";
import { createClient } from "@/lib/supabase/client";

// Each label is the key of its message
const OPTIONS: { value: SfwMode; label: string }[] = [
  { value: "off", label: "settings.sfw.off" },
  { value: "blur", label: "settings.sfw.blurImages" },
  { value: "hide", label: "settings.sfw.hidePosts" },
];

export default function SfwSetting({
  userId,
  savedMode,
}: {
  userId: string;
  savedMode: SfwMode;
}) {
  const t = useTranslations();
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
      setError(t("errors.settingSaveFailed"));
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
        {t("settings.sfw.title")}
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
          {t(o.label)}
        </label>
      ))}
      {error && <p className="text-sm text-danger">{error}</p>}
    </fieldset>
  );
}
