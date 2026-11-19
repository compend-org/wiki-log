// ABOUTME: Shows whether the signed-in person has verified their email address.
// ABOUTME: Sends a verification link to anyone who hasn't yet.
"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/auth/Turnstile";
import { track } from "@/lib/analytics/analytics";
import { authMessage } from "@/lib/errors/userFacingErrorMessage";
import { createClient } from "@/lib/supabase/client";

export default function EmailVerification({
  email,
  verified,
}: {
  email: string;
  verified: boolean;
}) {
  const t = useTranslations();
  const [busy, setBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [captcha, setCaptcha] = useState<string>("");
  const [captchaKey, setCaptchaKey] = useState<number>(0);

  const cannotSend = busy || (TURNSTILE_SITE_KEY !== "" && !captcha);

  async function handleSend() {
    setBusy(true);
    setMessage("");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/settings`,
        captchaToken: captcha || undefined,
      },
    });
    setBusy(false);
    // The token is spent: get a fresh one for the next try
    setCaptcha("");
    setCaptchaKey((k) => k + 1);
    if (error) {
      setMessage(
        /rate|seconds|too many/i.test(error.message)
          ? t("errors.pleaseWait")
          : authMessage(error, t("errors.sendLinkFailed")),
      );
      return;
    }
    track("verification_email_resent");
    setMessage(t("auth.sentLinkInline", { email }));
  }

  return (
    <section className="flex flex-col gap-2 text-sm">
      <h2>{t("auth.email")}</h2>
      <p className="text-muted">
        {email} {verified ? "is verified." : "isn't verified yet."}
      </p>
      {!verified && (
        <>
          <Turnstile key={captchaKey} onToken={setCaptcha} />
          <button
            type="button"
            onClick={handleSend}
            disabled={cannotSend}
            className="bg-accent px-4 py-2 text-background disabled:opacity-40"
          >
            {busy ? t("auth.sending") : t("auth.verifyEmail")}
          </button>
        </>
      )}
      {message && <p className="text-muted">{message}</p>}
    </section>
  );
}
