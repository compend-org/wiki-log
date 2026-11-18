// ABOUTME: Ties analytics events to whoever the server says is signed in, keeps their
// ABOUTME: details current, and starts a fresh anonymous visitor when they sign out in any tab.
"use client";

import { useEffect, useRef } from "react";
import {
  forgetPerson,
  identifyPerson,
  sendLandingPageView,
  updatePerson,
} from "@/lib/analytics/analytics";
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
    const { data } = createClient().auth.onAuthStateChange((event, session) => {
      // A sign-out in another tab while this page loaded shows up as
      // starting with no session, since sign-outs aren't replayed
      const signedOutHere =
        event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !session);
      if (!signedOutHere || !identified.current) return;
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
      sendLandingPageView();
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
    sendLandingPageView();
  }, [userId, username, isAdmin]);

  return null;
}
