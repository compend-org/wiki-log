"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { signIn } from "@/app/actions";
import { cleanName, isValidName, escapeLike, NAME_RULES } from "@/lib/username";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [identifier, setIdentifier] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const result = await signIn({ identifier, password });
    if (result.error) {
      setBusy(false);
      setMessage(result.error);
      return;
    }
    // Full reload so the nav bar picks up the new session
    window.location.href = "/";
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
    const supabase = createClient();

    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", escapeLike(name))
      .maybeSingle();
    if (taken) {
      setBusy(false);
      setMessage("That name is taken.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: name } },
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (data.session) {
      window.location.href = "/";
    } else {
      setMessage("Check your email to confirm your account.");
    }
  }

  const inputClass =
    "rounded-lg border border-line px-4 py-2 bg-surface text-foreground";

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
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2 text-background disabled:opacity-40"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSignUp} className="flex flex-col gap-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoCapitalize="none"
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
            placeholder="Password (6+ characters)"
            required
            minLength={6}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-accent px-4 py-2 text-background disabled:opacity-40"
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
        }}
        className="text-sm underline"
      >
        {mode === "signin"
          ? "New here? Create an account"
          : "Already have an account? Sign in"}
      </button>

      {message && <p className="text-danger">{message}</p>}
    </main>
  );
}