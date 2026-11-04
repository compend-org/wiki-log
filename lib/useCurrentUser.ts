"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useCurrentUser() {
  // False until the server has confirmed whether anyone is signed in
  const [ready, setReady] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    // The authority: asks the server whether this account really exists
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (cancelled) return;
      if (error || !data.user) {
        // No session, or one for an account that no longer exists: forget it
        await supabase.auth.signOut({ scope: "local" });
        if (cancelled) return;
        setUserId(null);
        setEmail(null);
      } else {
        setUserId(data.user.id);
        setEmail(data.user.email ?? null);
      }
      setReady(true);
    });

    // Later changes (signing in or out, token refreshes). The very first event
    // only repeats what the browser has stored, so it is ignored.
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "INITIAL_SESSION") return;
        setUserId(session?.user?.id ?? null);
        setEmail(session?.user?.email ?? null);
        setReady(true);
      },
    );

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Their name and picture, refetched when they change them in Settings
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await createClient()
        .from("profiles")
        .select("username, avatar_path")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      setUsername(data?.username ?? null);
      setAvatarPath(data?.avatar_path ?? null);
    };

    load();
    window.addEventListener("profile-updated", load);
    return () => {
      cancelled = true;
      window.removeEventListener("profile-updated", load);
    };
  }, [userId]);

  return {
    ready,
    userId,
    email,
    username: userId ? username : null,
    avatarPath: userId ? avatarPath : null,
  };
}
