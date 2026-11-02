"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useCurrentUser() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);

  // Who is signed in, kept up to date on sign-in and sign-out
  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user?.id ?? null);
        setEmail(session?.user?.email ?? null);
      }
    );

    return () => listener.subscription.unsubscribe();
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
    userId,
    email,
    username: userId ? username : null,
    avatarPath: userId ? avatarPath : null,
  };
}