"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "@/app/actions";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/Turnstile";
import { createClient } from "@/lib/supabase/client";
import { cleanName, escapeLike, isValidName, NAME_RULES } from "@/lib/username";

export default function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [identifier, setIdentifier] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
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
    const result = await signIn({
      identifier,
      password,
      captchaToken: captcha || undefined,
    });
    if (result.error) {
      setBusy(false);
      resetCaptcha();
      if (/not confirmed/i.test(result.error)) {
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
      setMessage(result.error);
      return;
    }
    // Full reload so the nav bar picks up the new session
    window.location.href = next;
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = cleanName(username);
    if (!isValidName(name)) {
      setMessage(`Usernames are ${NAME_RULES}.`);
      return;
    }

    setBusy(true);
    setMessage("");
    setNotice("");
    const supabase = createClient();

    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", escapeLike(name))
      .maybeSingle();
    if (taken) {
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
      setMessage(
        /rate limit|too many/i.test(error.message)
          ? "A lot of people are signing up right now. Please try again in a few minutes."
          : error.message,
      );
      return;
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