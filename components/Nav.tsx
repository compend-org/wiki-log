"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { SITE_NAME } from "@/lib/site";
import Avatar from "@/components/Avatar";
import SettingsIcon from "./SettingsIcon";
import SearchIcon from "./SearchIcon";
import DiaryIcon from "./DiaryIcon";
import NotificationIcon from "./NotificationIcon";

export default function Nav() {
  const { userId, username, avatarPath } = useCurrentUser();
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

  const shownUnread = userId ? unread : 0;

  // Link blue, with the page you're on in black
  const tone = (href: string) =>
    pathname === href || pathname.startsWith(href + "/")
      ? "text-foreground"
      : "text-accent hover:text-foreground";

  return (
    <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line bg-surface px-4 py-2 text-sm sm:px-8">
      <Link
        href="/"
        className="mr-2 flex items-center gap-2 text-xl font-bold text-foreground no-underline"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-light.png"
          alt=""
          width={35}
          height={35}
          className="logo-light border-0"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-dark.png"
          alt=""
          width={35}
          height={35}
          className="logo-dark border-0"
        />
        {SITE_NAME}
      </Link>

      <Link
        href="/diary"
        aria-label="Diary"
        title="Diary"
        className={`flex ${tone("/diary")}`}
      >
        <DiaryIcon />
      </Link>

      <Link
        href="/search"
        aria-label="Search"
        title="Search"
        className={`flex ${tone("/search")}`}
      >
        <SearchIcon />
      </Link>

      {userId && (
        <Link
          href="/notifications"
          aria-label="Notifications"
          title="Notifications"
          className={`inline-flex items-center gap-1 ${tone("/notifications")}`}
        >
          <NotificationIcon />
          {shownUnread > 0 && (
            <span className="bg-accent px-1.5 text-xs font-bold text-background">
              {shownUnread > 9 ? "9+" : shownUnread}
            </span>
          )}
        </Link>
      )}

      <div className="ml-auto flex items-center gap-4">
        {userId ? (
          <>
            {username && (
              <Link
                href={`/u/${encodeURIComponent(username)}`}
                className="flex items-center gap-2 text-accent underline hover:no-underline"
              >
                <Avatar name={username} path={avatarPath} size={40} />
                <span className="max-w-[8rem] truncate">{username}</span>
              </Link>
            )}
            <Link
              href="/settings"
              aria-label="Settings"
              title="Settings"
              className={`flex ${tone("/settings")}`}
            >
              <SettingsIcon />
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-accent underline hover:no-underline"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="text-accent underline hover:no-underline"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}