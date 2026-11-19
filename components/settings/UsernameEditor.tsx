// ABOUTME: Lets the signed-in person change their username, on the settings page.
// ABOUTME: Redraws the page afterwards so everything showing the name picks it up.
"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { track } from "@/lib/analytics/analytics";
import {
  SAVE_FAILED,
  userFacingErrorMessage,
} from "@/lib/errors/userFacingErrorMessage";
import { submitOnModEnter } from "@/lib/hooks/submitShortcut";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import { createClient } from "@/lib/supabase/client";
import { cleanName, isValidName, NAME_RULES } from "@/lib/username";

export default function UsernameEditor({
  userId,
  savedUsername,
}: {
  userId: string;
  savedUsername: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [username, setUsername] = useLocalCopy(savedUsername);
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [refreshing, startRefresh] = useTransition();

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const name = cleanName(username);
    if (!isValidName(name)) {
      setMessage(t("auth.usernameRules", { rules: NAME_RULES }));
      return;
    }

    setBusy(true);
    setMessage("");
    const { error } = await createClient()
      .from("profiles")
      .update({ username: name })
      .eq("id", userId);
    setBusy(false);

    if (error) {
      setMessage(
        error.code === "23505"
          ? t("auth.usernameTaken")
          : userFacingErrorMessage(error, SAVE_FAILED),
      );
      return;
    }
    track("profile_updated", { field: "username" });
    setUsername(name);
    setMessage(t("common.saved"));
    // Redraws the top bar, the profile link and account deletion with the new
    // username
    startRefresh(() => router.refresh());
  }

  return (
    <>
      <form
        onSubmit={handleSave}
        onKeyDown={submitOnModEnter}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          {t("settings.username.label")}
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            // Saving replaces the text with the cleaned-up name, so typing
            // waits until the saved name is back
            readOnly={busy || refreshing}
            className="border border-line bg-surface px-4 py-2 text-foreground"
          />
        </label>
        <button
          type="submit"
          data-submit
          disabled={busy || refreshing}
          className="bg-accent px-4 py-2 text-background disabled:opacity-40"
        >
          {busy ? t("common.saving") : t("settings.username.save")}
        </button>
      </form>
      {message && <p className="text-sm">{message}</p>}
    </>
  );
}
