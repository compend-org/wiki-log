"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/useCurrentUser";
import SettingsIcon from "./SettingsIcon";
import SearchIcon from "./SearchIcon";
import DiaryIcon from "./DiaryIcon";
import NotificationIcon from "./NotificationIcon";

export default function Nav() {
  const { userId, username } = useCurrentUser();
  const [unread, setUnread] = useState<number>(0);
  const router = useRouter();
  const pathname = usePathname();

  // Refresh the unread count when you sign in or move to another page
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    createClient()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .eq("read", false)
      .then(({ count }) => {
        if (!cancelled) setUnread(count ?? 0);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, pathname]);

  // The notifications page tells us when everything has been read
  useEffect(() => {
    const clear = () => setUnread(0);
    window.addEventListener("notifications-read", clear);
    return () => window.removeEventListener("notifications-read", clear);
  }, []);

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  const shownName = username ?? "";
  const shownUnread = userId ? unread : 0;

  const tone = (href: string) =>
    pathname === href || pathname.startsWith(href + "/")
      ? "text-accent"
      : "text-muted hover:text-foreground";

  return (
    <nav className="sticky top-0 z-20 flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-accent/30 bg-background/80 px-4 py-3 backdrop-blur sm:px-8">
      <Link
        href="/"
        className="font-[family-name:var(--font-display-src)] text-2xl font-bold uppercase tracking-[0.2em] text-accent"      >
        YT Log
      </Link>
      <Link href="/diary" aria-label="Diary" title="Diary" className={`flex ${tone("/diary")}`}>
        <DiaryIcon />
      </Link>
      <Link href="/search" aria-label="Search" title="Search" className={`inline-flex items-center gap-1 ${tone("/search")}`} >
        <SearchIcon />
      </Link>
      {
        userId && (
          <Link href="/notifications" aria-label="Notifications" title="Notifications" className={`inline-flex items-center gap-1 ${tone("/notifications")}`}>
            <NotificationIcon />
            {shownUnread > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-background">
                {shownUnread > 9 ? "9+" : shownUnread}
              </span>
            )}
          </Link>
        )
      }
      <div className="ml-auto flex items-center gap-3 text-sm">
        {userId ? (
          <>
            {username && <Link href={`/u/${encodeURIComponent(username)}`} className="hidden text-muted sm:inline">
              {shownName}
            </Link>}
            <Link
              href="/settings"
              aria-label="Settings"
              title="Settings"
              className={`flex ${tone("/settings")}`}
            >
              <SettingsIcon />
            </Link>
            <button type="button" onClick={handleSignOut} className="underline">
              Sign out
            </button>
          </>
        ) : (
          <Link href="/login" className="underline">
            Sign in
          </Link>
        )}
      </div>
    </nav >
  );
}