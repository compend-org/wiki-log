"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "@/app/actions";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/Turnstile";
import { identifyPerson, track } from "@/lib/analytics";
import { applySfw, setStoredSfw } from "@/lib/sfw";
import { createClient } from "@/lib/supabase/client";
import { cleanName, isValidName, NAME_RULES } from "@/lib/username";

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [identifier, setIdentifier] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [confirmEmail, setConfirmEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  // An address that has been sent a confirmation link
  const [pendingEmail, setPendingEmail] = useState<string>("");
  const [notice, setNotice] = useState<string>("");
  // The bot check: a token is good for one request, so after each attempt the
  // widget is replaced (new key) to get a fresh one
  const [captcha, setCaptcha] = useState<string>("");
  const [captchaKey, setCaptchaKey] = useState<number>(0);

  const needsCaptcha = TURNSTILE_SITE_KEY !== "";
  const cannotSend = busy || (needsCaptcha && !captcha);
  const resetCaptcha = () => {
    setCaptcha("");
    setCaptchaKey((k) => k + 1);
  };

  // Where the confirmation link should bring the person back to
  const returnAddress = () => `${window.location.origin}${next}`;

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setNotice("");
    Sentry.addBreadcrumb({
      category: "auth.sign-in",
      message: "Sign-in action started",
    });
    let result: Awaited<ReturnType<typeof signIn>>;
    try {
      result = await signIn({
        identifier,
        password,
        captchaToken: captcha || undefined,
      });
    } catch (error) {
      setBusy(false);
      resetCaptcha();
      setMessage(
        "We couldn't confirm the sign-in result. Please try signing in again.",
      );
      Sentry.captureException(error, {
        tags: { action: "signIn", error_source: "login-form" },
        contexts: {
          browser_state: {
            online: navigator.onLine,
            visibility_state: document.visibilityState,
          },
        },
      });
      return;
    }
    Sentry.addBreadcrumb({
      category: "auth.sign-in",
      message: "Sign-in action returned",
      data: { outcome: result.error ? "error" : "success" },
    });
    if (result.error) {
      setBusy(false);
      resetCaptcha();
      if (/not confirmed/i.test(result.error)) {
        track("signin_failed", { reason: "unconfirmed" });
        if (identifier.includes("@")) {
          setPendingEmail(identifier.trim());
          setMessage("");
          setNotice(
            "Your email address hasn't been confirmed yet. Check your inbox for the link, or send it again.",
          );
        } else {
          setMessage(
            "Your email address hasn't been confirmed yet. Check your inbox, or sign in with your email address to have it sent again.",
          );
        }
        return;
      }
      track("signin_failed", { reason: "invalid" });
      setMessage(result.error);
      return;
    }
    // Tied to the account now, so the sign-in counts as theirs. The top bar
    // adds their username and admin flag once it redraws.
    if (result.userId) identifyPerson(result.userId);
    // Before the first page after signing in, so adult images never flash
    if (result.sfwMode) {
      setStoredSfw(result.sfwMode);
      applySfw(result.sfwMode);
    }
    track("signed_in", {
      method: identifier.includes("@") ? "email" : "username",
    });
    // Server-set cookies don't emit a browser auth event. Refresh mounted
    // user state, then navigate without aborting the action's RSC stream.
    window.dispatchEvent(new Event("auth-updated"));
    router.replace(next);
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = cleanName(username);
    if (!isValidName(name)) {
      setMessage(`Usernames are ${NAME_RULES}.`);
      return;
    }
    if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      setMessage("The two email addresses don't match.");
      return;
    }

    setBusy(true);
    setMessage("");
    setNotice("");
    const supabase = createClient();

    const { data: taken } = await supabase
      .rpc("profile_by_username", { name })
      .select("id")
      .maybeSingle();
    if (taken) {
      track("signup_failed", { reason: "username_taken" });
      setBusy(false);
      setMessage("That username is taken.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: name },
        emailRedirectTo: returnAddress(),
        captchaToken: captcha || undefined,
      },
    });
    setBusy(false);
    resetCaptcha();
    if (error) {
      track("signup_failed", {
        reason: /rate limit|too many/i.test(error.message)
          ? "rate_limited"
          : "other",
      });
      setMessage(
        /rate limit|too many/i.test(error.message)
          ? "A lot of people are signing up right now. Please try again in a few minutes."
          : error.message,
      );
      return;
    }
    // An address that already has an account gets a stand-in user with no
    // identities, so it isn't counted as a sign-up
    if (data.user && (data.user.identities?.length ?? 0) > 0) {
      // Ties this sign-up to the email confirmation the server records later
      identifyPerson(data.user.id, { username: name, is_admin: false });
      track("signed_up");
    }
    if (data.session) {
      window.location.href = next;
    } else {
      setPendingEmail(email.trim());
      setNotice(
        "Check your email for a confirmation link. It can take a minute, and it may land in spam.",
      );
    }
  }

  async function handleResend() {
    setBusy(true);
    setMessage("");
    const { error } = await createClient().auth.resend({
      type: "signup",
      email: pendingEmail,
      options: {
        emailRedirectTo: returnAddress(),
        captchaToken: captcha || undefined,
      },
    });
    setBusy(false);
    resetCaptcha();
    if (error) {
      setMessage(
        /rate|seconds|too many/i.test(error.message)
          ? "Please wait a minute before asking again."
          : error.message,
      );
      return;
    }
    track("verification_email_resent");
    setNotice(`We sent another link to ${pendingEmail}.`);
  }

  const inputClass = "border border-line bg-surface px-4 py-2 text-foreground";

  if (pendingEmail) {
    return (
      <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 p-4 sm:p-8">
        <h1 className="text-3xl font-bold">Check your email</h1>
        <p>
          We sent a confirmation link to{" "}
          <span className="font-semibold">{pendingEmail}</span>.
        </p>
        {notice && <p className="text-sm text-muted">{notice}</p>}
        <Turnstile key={captchaKey} onToken={setCaptcha} />
        <button
          type="button"
          onClick={handleResend}
          disabled={cannotSend}
          className="self-start border border-line px-4 py-2 disabled:opacity-40"
        >
          {busy ? "Sending…" : "Send it again"}
        </button>
        <button
          type="button"
          onClick={() => {
            setPendingEmail("");
            setNotice("");
            setMessage("");
          }}
          className="self-start text-sm underline"
        >
          Back
        </button>
        {message && <p className="text-danger">{message}</p>}
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">
        {mode === "signin" ? "Sign in" : "Create account"}
      </h1>

      {mode === "signin" ? (
        <form onSubmit={handleSignIn} className="flex flex-col gap-3">
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Email or username"
            autoCapitalize="none"
            required
            className={inputClass}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className={inputClass}
          />
          <Turnstile key={captchaKey} onToken={setCaptcha} />
          <button
            type="submit"
            disabled={cannotSend}
            className="bg-accent px-4 py-2 text-background disabled:opacity-40"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <Link href="/forgot-password" className="text-sm underline">
            Forgot your password?
          </Link>
        </form>
      ) : (
        <form onSubmit={handleSignUp} className="flex flex-col gap-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            required
            className={inputClass}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className={inputClass}
          />
          <input
            type="email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            onPaste={(e) => e.preventDefault()}
            placeholder="Type your email again"
            autoComplete="off"
            required
            className={inputClass}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (8+ characters)"
            required
            minLength={8}
            className={inputClass}
          />
          <Turnstile key={captchaKey} onToken={setCaptcha} />
          <button
            type="submit"
            disabled={cannotSend}
            className="bg-accent px-4 py-2 text-background disabled:opacity-40"
          >
            {busy ? "Creating…" : "Create account"}
          </button>
          <p className="text-xs text-muted">
            By creating an account you agree that your username, logs and
            reviews are public. See the{" "}
            <Link href="/privacy" className="underline">
              privacy page
            </Link>
            .
          </p>
        </form>
      )}

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setMessage("");
          setNotice("");
          resetCaptcha();
        }}
        className="text-sm underline"
      >
        {mode === "signin"
          ? "New here? Create an account"
          : "Already have an account? Sign in"}
      </button>

      {notice && <p className="text-sm text-muted">{notice}</p>}
      {message && <p className="text-danger">{message}</p>}
    </main>
  );
}
