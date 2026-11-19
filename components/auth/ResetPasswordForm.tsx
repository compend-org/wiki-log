"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { track } from "@/lib/analytics/analytics";
import { authMessage } from "@/lib/errors/userFacingErrorMessage";
import { submitOnModEnter } from "@/lib/hooks/submitShortcut";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordForm() {
  const t = useTranslations();
  const [password, setPassword] = useState<string>("");
  const [confirm, setConfirm] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 8) {
      setError(t("auth.reset.tooShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.reset.dontMatch"));
      return;
    }

    setBusy(true);
    setError("");
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(authMessage(error, t("auth.reset.failed")));
      return;
    }
    track("password_reset_completed");
    setDone(true);
    setTimeout(() => {
      window.location.href = "/";
    }, 1500);
  }

  if (done) return <p>{t("auth.reset.done")}</p>;

  const inputClass = "border border-line bg-surface px-4 py-2 text-foreground";

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={submitOnModEnter}
      className="flex flex-col gap-3"
    >
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t("auth.newPassword")}
        autoComplete="new-password"
        required
        minLength={8}
        className={inputClass}
      />
      <input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder={t("auth.repeatNewPassword")}
        autoComplete="new-password"
        required
        className={inputClass}
      />
      <button
        type="submit"
        data-submit
        disabled={busy}
        className="bg-accent px-4 py-2 text-background disabled:opacity-40"
      >
        {busy ? t("common.saving") : t("auth.reset.save")}
      </button>
      {error && <p className="text-danger">{error}</p>}
    </form>
  );
}
