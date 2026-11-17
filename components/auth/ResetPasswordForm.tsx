"use client";

import { useState } from "react";
import { track } from "@/lib/analytics/analytics";
import { authMessage } from "@/lib/errors/userFacingErrorMessage";
import { submitOnModEnter } from "@/lib/hooks/submitShortcut";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordForm() {
  const [password, setPassword] = useState<string>("");
  const [confirm, setConfirm] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }

    setBusy(true);
    setError("");
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(
        authMessage(error, "Couldn't change your password. Please try again."),
      );
      return;
    }
    track("password_reset_completed");
    setDone(true);
    setTimeout(() => {
      window.location.href = "/";
    }, 1500);
  }

  if (done) return <p>Password updated. Taking you home…</p>;

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
        placeholder="New password (8+ characters)"
        autoComplete="new-password"
        required
        minLength={8}
        className={inputClass}
      />
      <input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Repeat the new password"
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
        {busy ? "Saving…" : "Save password"}
      </button>
      {error && <p className="text-danger">{error}</p>}
    </form>
  );
}
