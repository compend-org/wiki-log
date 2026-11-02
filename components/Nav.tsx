"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { SITE_NAME } from "@/lib/site";
import Avatar from "@/components/Avatar";
import DiaryIcon from "./DiaryIcon";
import NotificationIcon from "./NotificationIcon";
import SignOutButton from "./SignOutButton";
import SignInButton from "./SignInButton";
import CraftIcon from "./CraftIcon";
import { useLoginHref } from "@/lib/useLoginHref";
import { FEATURES } from "@/lib/features";
import PeopleSearch from "./PeopleSearch";

export default function Nav() {
  const loginHref = useLoginHref();
  const { userId, username, avatarPath, ready } = useCurrentUser();
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
    <nav className="flex relative flex-nowrap items-center justify-between gap-x-3 border-b border-line bg-surface px-4 py-2 text-sm sm:flex-wrap sm:justify-start sm:gap-x-5 sm:gap-y-1 sm:px-8">      <Link
      href="/"
      className="sm:mr-2 flex items-center gap-2 text-xl font-bold text-foreground no-underline"
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
      <span className="hidden sm:inline">{SITE_NAME}</span>
    </Link>

      <Link
        href="/diary"
        aria-label="Diary"
        title="Diary"
        className={`flex ${tone("/diary")}`}
      >
        <DiaryIcon />
      </Link>

      <PeopleSearch />
      {FEATURES.compounds && (
        <Link
          href="/craft"
          aria-label="Craft a compound"
          title="Craft a compound"
          className={`flex ${tone("/craft")}`}
        >
          <CraftIcon />
        </Link>
      )}

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

      <div className="contents sm:ml-auto sm:flex sm:items-center sm:gap-4">
        {!ready ? (
          // Reserves the space while we find out who is signed in, so neither
          // the login nor the logout button flashes up
          <div className="h-5 w-5 sm:w-24" aria-hidden="true" />
        ) : userId ? (
          <>
            {username && (
              <Link
                href={`/u/${encodeURIComponent(username)}`}
                aria-label={`${username}'s profile`}
                className="flex items-center gap-2 text-accent underline hover:no-underline"
              >
                <Avatar name={username} path={avatarPath} size={40} />
                <span className="hidden max-w-[8rem] truncate sm:inline">{username}</span>
              </Link>
            )}
            {/* <Link
              href="/settings"
              aria-label="Settings"
              title="Settings"
              className={`flex ${tone("/settings")}`}
            >
              <SettingsIcon />
            </Link> */}
            <SignOutButton
              className="hidden sm:inline-flex"
              labelClassName="hidden sm:inline"
            />
          </>
        ) : (
          <SignInButton
            className="inline-flex"
            labelClassName="hidden sm:inline"
          />
        )}
      </div>
    </nav>
  );
}