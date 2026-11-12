"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminBadge from "@/components/AdminBadge";
import NotificationThumb, {
  type NotificationSubject,
} from "@/components/NotificationThumb";
import { track } from "@/lib/analytics";
import { timeAgo } from "@/lib/format";
import {
  fetchNotifications,
  latestNotifications,
  markNotificationsRead,
  type NotificationRow,
  type NotificationsFeed,
} from "@/lib/notificationsFeed";
import { currentSfwMode, shownEntries } from "@/lib/sfw";
import { createClient } from "@/lib/supabase/client";
import { useLoginHref } from "@/lib/useLoginHref";

type NotificationsState = {
  loaded: boolean;
  signedIn: boolean;
  error: string;
  feed: NotificationsFeed;
};

const EMPTY_FEED: NotificationsFeed = {
  rows: [],
  logs: {},
  items: {},
  lists: {},
  owners: {},
  adminIds: new Set(),
  myId: "",
  loadedAt: 0,
};

// A person's name linked to their profile, above the card's full-card link,
// followed by the admin badge if they are one
function PersonLink({
  username,
  isAdmin,
}: {
  username: string;
  isAdmin: boolean;
}) {
  return (
    <>
      <Link
        href={`/u/${encodeURIComponent(username)}`}
        className="relative z-10 font-semibold hover:underline"
      >
        {username}
      </Link>
      {isAdmin && (
        <>
          {" "}
          <AdminBadge />
        </>
      )}
    </>
  );
}

export default function NotificationsPage() {
  const loginHref = useLoginHref();
  // Opens with the feed last fetched in this tab, if any, while a fresh one
  // loads
  const [state, setState] = useState<NotificationsState>(() => {
    const kept = latestNotifications();
    return kept
      ? { loaded: true, signedIn: true, error: "", feed: kept }
      : { loaded: false, signedIn: false, error: "", feed: EMPTY_FEED };
  });
  const { loaded, signedIn, error, feed } = state;
  const { logs, items, lists, owners, adminIds, myId, loadedAt } = feed;
  // Notices about reviews of adult items are left out when the viewer hides
  // them. Moderators' messages always show.
  const rows = shownEntries(feed.rows, currentSfwMode(), (n) => {
    const entry = n.log_id ? logs[n.log_id] : undefined;
    return n.type !== "moderation" && Boolean(entry && items[entry.item]?.nsfw);
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setState({
          loaded: true,
          signedIn: false,
          error: "",
          feed: EMPTY_FEED,
        });
        return;
      }
      const userId = userData.user.id;
      const result = await fetchNotifications(userId);
      if ("error" in result) {
        // Keeps showing the kept feed only if it is this person's
        setState((previous) => ({
          loaded: true,
          signedIn: true,
          error: result.error,
          feed: previous.feed.myId === userId ? previous.feed : EMPTY_FEED,
        }));
        return;
      }

      // Publish the notifications and all their display data together.
      setState({ loaded: true, signedIn: true, error: "", feed: result.feed });

      // Opening the page marks everything as read
      if (result.feed.rows.some((n) => !n.read)) {
        const { error: markError } = await supabase
          .from("notifications")
          .update({ read: true })
          .eq("recipient_id", userId)
          .eq("read", false);
        if (!markError) markNotificationsRead(result.feed);
        window.dispatchEvent(new Event("notifications-read"));
      }
    }
    load();
  }, []);

  // `rest` is everything after the username. `reviewOwner` is a second person
  // named at the very end of it. `subject` is the card's picture.
  function describe(n: NotificationRow): {
    rest: string;
    href: string;
    reviewOwner?: { id: string; username: string };
    subject: NotificationSubject | null;
  } {
    const entry = n.log_id ? logs[n.log_id] : undefined;
    const item = entry ? items[entry.item] : undefined;
    const title = item?.title ?? "an item";
    const ownerName = entry ? owners[entry.owner] : undefined;
    const itemSubject: NotificationSubject | null = item
      ? { kind: "item", item }
      : null;
    const list = n.list_id ? lists[n.list_id] : undefined;
    const listSubject: NotificationSubject | null = list
      ? { kind: "list", title: list.title, items: list.items }
      : null;
    const reviewHref =
      ownerName && n.log_id
        ? `/u/${encodeURIComponent(ownerName)}/${n.log_id}`
        : "/";
    const listTitle = n.list_id ? (list?.title ?? "a list") : "";
    const listHref = n.list_id ? `/list/${n.list_id}#comments` : "/";

    // Something done to the viewer's comment on a review, which may be their
    // own review or someone else's
    function onYourReviewComment(verb: string) {
      if (entry?.owner === myId) {
        return {
          rest: ` ${verb} your comment on your review of ${title}`,
          href: reviewHref,
          subject: itemSubject,
        };
      }
      return {
        rest: ` ${verb} your comment on a review of ${title} by ${ownerName ? "" : "someone"}`,
        href: reviewHref,
        reviewOwner:
          entry && ownerName
            ? { id: entry.owner, username: ownerName }
            : undefined,
        subject: itemSubject,
      };
    }

    switch (n.type) {
      case "like":
        return {
          rest: ` liked your review of ${title}`,
          href: reviewHref,
          subject: itemSubject,
        };
      case "comment":
        return {
          rest: ` commented on your review of ${title}`,
          href: reviewHref,
          subject: itemSubject,
        };
      case "reply":
        return onYourReviewComment("replied to");
      case "comment_like":
        return onYourReviewComment("liked");
      case "follow":
        return {
          rest: " started following you",
          href: n.profiles
            ? `/u/${encodeURIComponent(n.profiles.username)}`
            : "/",
          subject: n.profiles
            ? {
                kind: "person",
                username: n.profiles.username,
                avatarPath: n.profiles.avatar_path,
              }
            : null,
        };
      case "share":
        return {
          rest: ` shared your review of ${title}`,
          href: reviewHref,
          subject: itemSubject,
        };
      case "list_share":
        return {
          rest: ` shared your list “${listTitle}”`,
          href: n.list_id ? `/list/${n.list_id}` : "/",
          subject: listSubject,
        };
      case "list_like":
        return {
          rest: ` liked your list “${listTitle}”`,
          href: n.list_id ? `/list/${n.list_id}` : "/",
          subject: listSubject,
        };
      case "list_comment":
        return {
          rest: ` commented on your list “${listTitle}”`,
          href: listHref,
          subject: listSubject,
        };
      case "list_reply":
        return {
          rest: ` replied to your comment on the list “${listTitle}”`,
          href: listHref,
          subject: listSubject,
        };
      case "list_comment_like":
        return {
          rest: ` liked your comment on the list “${listTitle}”`,
          href: listHref,
          subject: listSubject,
        };
      case "mention":
        if (n.list_id) {
          return {
            rest: ` mentioned you in a comment on the list “${listTitle}”`,
            href: listHref,
            subject: listSubject,
          };
        }
        if (!n.comment_id) {
          return {
            rest: ` mentioned you in their review of ${title}`,
            href: reviewHref,
            subject: itemSubject,
          };
        }
        if (entry?.owner === myId || entry?.owner === n.actor_id) {
          return {
            rest: ` mentioned you in a comment on ${entry.owner === myId ? "your" : "their"} review of ${title}`,
            href: reviewHref,
            subject: itemSubject,
          };
        }
        return {
          rest: ` mentioned you in a comment on a review of ${title} by ${ownerName ? "" : "someone"}`,
          href: reviewHref,
          reviewOwner:
            entry && ownerName
              ? { id: entry.owner, username: ownerName }
              : undefined,
          subject: itemSubject,
        };
      case "moderation":
        return {
          rest: n.body ?? "",
          href: n.log_id
            ? reviewHref
            : n.list_id
              ? `/list/${n.list_id}`
              : "/notifications",
          subject: n.log_id ? itemSubject : listSubject,
        };
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Notifications</h1>

      {!loaded && <p className="text-muted">Loading…</p>}

      {loaded && !signedIn && (
        <Link href={loginHref} className="underline">
          Sign in to see your notifications
        </Link>
      )}

      {error && <p className="text-danger">{error}</p>}

      {loaded && signedIn && !error && rows.length === 0 && (
        <p className="text-muted">
          Nothing yet. You&apos;ll see likes, shares, comments, replies,
          mentions and new followers here.
        </p>
      )}

      {rows.map((n) => {
        const { rest, href, reviewOwner, subject } = describe(n);
        const actor = n.profiles?.username;
        return (
          <div
            key={n.id}
            className={`relative flex items-center gap-3 border p-3 hover:border-accent/60 ${
              n.read ? "border-line" : "border-accent bg-surface"
            }`}
          >
            <Link
              href={href}
              aria-label={
                n.type === "moderation"
                  ? `From the moderators: ${rest}`
                  : `${actor ?? "Someone"}${rest}${reviewOwner?.username ?? ""}`
              }
              onClick={() => track("notification_clicked", { type: n.type })}
              className="absolute inset-0"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-sm [overflow-wrap:anywhere]">
                {n.type === "moderation" ? (
                  <span className="font-semibold">From the moderators: </span>
                ) : actor && n.actor_id ? (
                  <PersonLink
                    username={actor}
                    isAdmin={adminIds.has(n.actor_id)}
                  />
                ) : (
                  "Someone"
                )}
                {rest}
                {reviewOwner && (
                  <PersonLink
                    username={reviewOwner.username}
                    isAdmin={adminIds.has(reviewOwner.id)}
                  />
                )}
              </span>
              <span className="text-xs text-muted">
                {timeAgo(n.created_at, loadedAt)}
              </span>
            </div>
            {subject && <NotificationThumb subject={subject} />}
          </div>
        );
      })}
    </main>
  );
}
