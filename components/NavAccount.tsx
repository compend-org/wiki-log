// ABOUTME: Looks up who is signed in, their profile and unread count on the server,
// ABOUTME: so the top bar's account section arrives with the page, and tells analytics who it is.
import { connection } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import AnalyticsIdentity from "./AnalyticsIdentity";
import NavAccountLinks, { type NavAccountDetails } from "./NavAccountLinks";

async function getSignedInAccount(): Promise<NavAccountDetails | null> {
  // Checking the session compares its expiry with the current time, so this
  // runs for each request rather than ahead of time
  await connection();
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const [{ data: profile }, { count }] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, avatar_path")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .eq("read", false),
  ]);

  // A session for an account that no longer exists counts as signed out
  if (!profile) return null;

  return {
    userId,
    username: profile.username,
    avatarPath: profile.avatar_path,
    unread: count ?? 0,
  };
}

export default async function NavAccount() {
  const account = await getSignedInAccount();
  const admin = await isAdmin(account?.userId);
  return (
    <>
      <AnalyticsIdentity
        userId={account?.userId ?? null}
        username={account?.username ?? ""}
        isAdmin={admin}
      />
      {/* A different account starts over, rather than keeping the last one's state */}
      <NavAccountLinks key={account?.userId} account={account} />
    </>
  );
}
