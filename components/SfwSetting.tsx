"use client";

// ABOUTME: The profile setting for SFW mode: off, blur adult images, or hide adult posts.
// ABOUTME: Saved to the account, and applied to this page as soon as it is chosen.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { applySfw, parseSfwMode, type SfwMode, setStoredSfw } from "@/lib/sfw";
import { createClient } from "@/lib/supabase/client";

const OPTIONS: { value: SfwMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "blur", label: "Blur adult images" },
  { value: "hide", label: "Hide adult posts" },
];

export default function SfwSetting({ userId }: { userId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<SfwMode>("off");
  const [error, setError] = useState("");

  useEffect(() => {
    createClient()
      .from("user_settings")
      .select("sfw_mode")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => setMode(parseSfwMode(data?.sfw_mode)));
  }, [userId]);

  async function choose(next: SfwMode) {
    const before = mode;
    track("sfw_mode_changed", { mode: next });
    setMode(next);
    setStoredSfw(next);
    applySfw(next);
    setError("");

    const { error: saveError } = await createClient()
      .from("user_settings")
      .upsert({ user_id: userId, sfw_mode: next });
    if (saveError) {
      setMode(before);
      setStoredSfw(before);
      applySfw(before);
      setError("Couldn't save that. Try again.");
      return;
    }
    // Pages drawn on the server pick up the new mode
    router.refresh();
  }

  return (
    <fieldset className="flex flex-col gap-2">
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
