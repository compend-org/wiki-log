// ABOUTME: Shows whether the signed-in person has verified their email address.
// ABOUTME: Sends a verification link to anyone who hasn't yet.
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function EmailVerification() {
  const [email, setEmail] = useState<string>("");
  const [verified, setVerified] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.email) return;
      const { data } = await supabase
        .from("email_verifications")
        .select("user_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      setVerified(Boolean(data));
      setEmail(userData.user.email);
    }
    load();
  }, []);

  async function handleSend() {
    setBusy(true);
    setMessage("");
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/settings`,
      },
    });
    setBusy(false);
    if (error) {
      setMessage(
        /rate|seconds|too many/i.test(error.message)
          ? "Please wait a minute before asking again."
          : error.message,
      );
      return;
    }
    setMessage(
      `We sent a link to ${email}. It can take a minute, and it may land in spam.`,
    );
  }

  if (!email) return null;

  return (
    <section className="flex flex-col gap-2 text-sm">
      <h2>Email</h2>
      <p className="text-muted">
        {email} {verified ? "is verified." : "isn't verified yet."}
      </p>
      {!verified && (
        <button
          type="button"
          onClick={handleSend}
          disabled={busy}
          className="bg-accent px-4 py-2 text-background disabled:opacity-40"
        >
          {busy ? "Sending…" : "Verify your email"}
        </button>
      )}
      {message && <p className="text-muted">{message}</p>}
    </section>
  );
}
