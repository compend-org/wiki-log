// ABOUTME: The top bar's account section: notifications bell, profile link and
// ABOUTME: sign in/out, drawn from details the server looked up and kept in the browser.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import {
  fetchNotifications,
  keepNotificationsOnlyFor,
} from "@/lib/notificationsFeed";
import { applySfw, type SfwMode, setStoredSfw } from "@/lib/sfw";
import { createClient } from "@/lib/supabase/client";
import { isCurrentPage, useNavLinkTone } from "@/lib/useNavLinkTone";
import SignInButton from "./buttons/SignInButton";
import SignOutButton from "./buttons/SignOutButton";
import NotificationIcon from "./icons/NotificationIcon";

export type NavAccountDetails = {
  userId: string;
  username: string | null;
  avatarPath: string | null;
  unread: number;
  sfwMode: SfwMode;
};

const ACCOUNT_AREA = "contents sm:ml-auto sm:flex sm:items-center sm:gap-4";

const UNREAD_REFRESH_MS = 60_000;

// The browser's copy of the signed-in account section, as HTML
const SNAPSHOT_KEY = "nav-account-snapshot";

// Runs as the page is read, before the first paint, and fills the placeholder
// with the account section as it last looked
const FILL_FROM_SNAPSHOT = `try{var s=localStorage.getItem(${JSON.stringify(SNAPSHOT_KEY)});if(s)document.currentScript.previousElementSibling.innerHTML=s}catch(e){}`;

// Reserves the space while we find out who is signed in, so neither the login
// nor the logout button flashes up. Shaped like the signed-in bell and avatar
// so nothing moves when they arrive, and filled from the browser's copy when
// there is one so the account section shows from the first paint.
export function NavAccountPlaceholder() {
  return (
    <>
      <div className="contents">
        <div className="h-6 w-6" aria-hidden="true" />
        <div className={ACCOUNT_AREA}>
          <div className="h-10 w-10 rounded-full" aria-hidden="true" />
        </div>
      </div>
      <script
        type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
        suppressHydrationWarning
        // biome-ignore lint/security/noDangerouslySetInnerHtml: injects the app's own constant script
        dangerouslySetInnerHTML={{ __html: FILL_FROM_SNAPSHOT }}
      />
    </>
  );
}

export default function NavAccountLinks({
  account,
}: {
  account: NavAccountDetails | null;
}) {
  const userId = account?.userId ?? null;
  const [unread, setUnread] = useState<number>(account?.unread ?? 0);
  const pathname = usePathname();
  const tone = useNavLinkTone();
  const snapshotSource = useRef<HTMLDivElement>(null);

  // Keeps the page and this browser's copy in step with the account's SFW
  // mode, which is off once signed out
  const sfwMode = account?.sfwMode ?? "off";
  useEffect(() => {
    setStoredSfw(sfwMode);
    applySfw(sfwMode);
  }, [sfwMode]);

  // The server counted the unread notifications for the first render
  const unreadCheckedAt = useRef(Date.now());
  const refreshUnread = useRef<(() => void) | null>(null);

  // Refresh the unread count when you come back to the page, at most once a
  // minute
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let inFlight = false;

    const refresh = () => {
      // Focus and visibilitychange fire together; one request covers both
      if (inFlight) return;
      inFlight = true;
      unreadCheckedAt.current = Date.now();
      createClient()
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", userId)
        .eq("read", false)
        .then(({ count }) => {
          inFlight = false;
          if (!cancelled) setUnread(count ?? 0);
        });
    };
    const refreshIfVisible = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - unreadCheckedAt.current >= UNREAD_REFRESH_MS
      ) {
        refresh();
      }
    };

    refreshUnread.current = refresh;
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      cancelled = true;
      refreshUnread.current = null;
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [userId]);

  // Moving to another page refreshes it too, at most once a minute
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname refreshes the unread count on navigation
  useEffect(() => {
    if (Date.now() - unreadCheckedAt.current >= UNREAD_REFRESH_MS) {
      refreshUnread.current?.();
    }
  }, [pathname]);

  // Copies the account section as it looks now for the placeholder to show on
  // the next full page load, or forgets it once signed out. Skipped on the
  // notifications page, where the bell is drawn as the current page.
  useEffect(() => {
    try {
      if (!account) {
        localStorage.removeItem(SNAPSHOT_KEY);
      } else if (
        snapshotSource.current &&
        !isCurrentPage(pathname, "/notifications")
      ) {
        localStorage.setItem(SNAPSHOT_KEY, snapshotSource.current.innerHTML);
      }
    } catch {
      // Storage can be unavailable (private browsing, full); the placeholder
      // then stays empty until the server's version arrives
    }
  });

  // Fetches the notifications ahead of a visit when there are new ones, so
  // the page opens with them
  useEffect(() => {
    keepNotificationsOnlyFor(userId);
    if (userId && unread > 0) fetchNotifications(userId);
  }, [userId, unread]);

  // The notifications page tells us when everything has been read
  useEffect(() => {
    const clear = () => setUnread(0);
    window.addEventListener("notifications-read", clear);
    return () => window.removeEventListener("notifications-read", clear);
  }, []);

  if (!account) {
    return (
      <div className={ACCOUNT_AREA}>
        <SignInButton
          className="inline-flex"
          labelClassName="hidden sm:inline"
        />
      </div>
    );
  }

  const { username, avatarPath } = account;

  return (
    <div ref={snapshotSource} className="contents">
      <Link
        href="/notifications"
        aria-label="Notifications"
        prefetch={false}
        title="Notifications"
        className={`inline-flex items-center gap-1 ${tone("/notifications")}`}
      >
        <NotificationIcon />
        {unread > 0 && (
          <span className="bg-accent px-1.5 text-xs font-bold text-background">
            {unread > 20 ? "20+" : unread}
          </span>
        )}
      </Link>
      <div className={ACCOUNT_AREA}>
        {username && (
          <Link
            href={`/u/${encodeURIComponent(username)}`}
            aria-label={`${username}'s profile`}
            prefetch={false}
            className={`flex items-center gap-2 hover:underline ${tone(
              `/u/${encodeURIComponent(username)}`,
            )}`}
          >
            <Avatar name={username} path={avatarPath} size={40} />
            <span className="hidden max-w-[8rem] truncate sm:inline">
              {username}
            </span>
          </Link>
        )}
        <SignOutButton
          className="hidden sm:inline-flex"
          labelClassName="hidden sm:inline"
        />
      </div>
    </div>
  );
}
