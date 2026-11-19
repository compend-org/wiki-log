"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/auth/Turnstile";
import { track } from "@/lib/analytics/analytics";
import { submitOnModEnter } from "@/lib/hooks/submitShortcut";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordForm() {
  const t = useTranslations();
  const [email, setEmail] = useState<string>("");
  const [sent, setSent] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [captcha, setCaptcha] = useState<string>("");
  const [captchaKey, setCaptchaKey] = useState<number>(0);

  const cannotSend = busy || (TURNSTILE_SITE_KEY !== "" && !captcha);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.resetPasswordForEmail(
      email.trim(),
      { captchaToken: captcha || undefined },
    );
    setBusy(false);
    // The token is spent: get a fresh one for the next try
    setCaptcha("");
    setCaptchaKey((k) => k + 1);
    if (error && /rate|seconds|too many/i.test(error.message)) {
      setError(t("errors.pleaseWait"));
      return;
    }
    // The same answer whether or not an account exists, so this form can't be
    // used to find out who has one
    track("password_reset_requested");
    setSent(true);
  }

  if (sent) {
    return <p>{t("auth.forgot.sent")}</p>;
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={submitOnModEnter}
      className="flex flex-col gap-3"
    >
      <p className="text-sm text-muted">{t("auth.forgot.instructions")}</p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("auth.email")}
        spellCheck={false}
        required
        className="border border-line bg-surface px-4 py-2 text-foreground"
      />
      <Turnstile key={captchaKey} onToken={setCaptcha} />
      <button
        type="submit"
        data-submit
        disabled={cannotSend}
        className="bg-accent px-4 py-2 text-background disabled:opacity-40"
      >
        {busy ? t("auth.sending") : t("auth.forgot.send")}
      </button>
      {error && <p className="text-danger">{error}</p>}
    </form>
  );
}
