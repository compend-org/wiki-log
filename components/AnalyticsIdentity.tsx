// ABOUTME: Ties analytics events to whoever the server says is signed in, keeps their
// ABOUTME: details current, and starts a fresh anonymous visitor when they sign out in any tab.
"use client";

import { useEffect, useRef } from "react";
import { forgetPerson, identifyPerson, updatePerson } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";

export default function AnalyticsIdentity({
  userId,
  username,
  isAdmin,
}: {
  userId: string | null;
  username: string;
  isAdmin: boolean;
}) {
  // Who this browser's events are tied to, if anyone
  const identified = useRef<string | null>(null);
  // An account that signed out, possibly in another tab, while this page was
  // still drawn for it
  const signedOut = useRef<string | null>(null);

  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT" || !identified.current) return;
      signedOut.current = identified.current;
      identified.current = null;
      forgetPerson();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (userId !== signedOut.current) signedOut.current = null;
    if (!userId || userId === signedOut.current) {
      if (identified.current) forgetPerson();
      identified.current = null;
      return;
    }
    const properties = { username, is_admin: isAdmin };
    if (userId === identified.current) {
      updatePerson(properties);
      return;
    }
    if (identified.current) forgetPerson();
    identifyPerson(userId, properties);
    identified.current = userId;
  }, [userId, username, isAdmin]);

  return null;
}
