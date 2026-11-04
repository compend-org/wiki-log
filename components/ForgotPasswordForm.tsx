"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState<string>("");
  const [sent, setSent] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.resetPasswordForEmail(
      email.trim(),
    );
    setBusy(false);
    if (error && /rate|seconds|too many/i.test(error.message)) {
      setError("Please wait a minute before asking again.");
      return;
    }
    // The same answer whether or not an account exists, so this form can't be
    // used to find out who has one
    setSent(true);
  }

  if (sent) {
    return (
      <p>
        If there&apos;s an account for that address, we&apos;ve sent it a link
        to choose a new password. It can take a minute, and it may land in spam.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Enter the email address you signed up with.
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
        className="border border-line bg-surface px-4 py-2 text-foreground"
      />
      <button
        type="submit"
        disabled={busy}
        className="bg-accent px-4 py-2 text-background disabled:opacity-40"
      >
        {busy ? "Sending…" : "Send reset link"}
      </button>
      {error && <p className="text-danger">{error}</p>}
    </form>
  );
}
