"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminBadge from "@/components/AdminBadge";
import NotificationThumb, {
  MOSAIC_SIZE,
  type NotificationSubject,
} from "@/components/NotificationThumb";
import { track } from "@/lib/analytics";
import type { Thumb } from "@/lib/feedData";
import { shownImage, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { useLoginHref } from "@/lib/useLoginHref";

type NotificationRow = {
  id: string;
  type:
    | "like"
    | "comment"
    | "reply"
    | "follow"
    | "list_like"
    | "list_comment"
    | "list_reply"
    | "share"
    | "list_share"
    | "moderation"
    | "comment_like"
    | "list_comment_like"
    | "mention";
  read: boolean;
  created_at: string;
  log_id: string | null;
  list_id: string | null;
  // Set when the notice is about a comment, on a review or on a list
  comment_id: string | null;
  list_comment_id: string | null;
  // Moderators' messages have no actor, just a body
  actor_id: string | null;
  body: string | null;
  profiles: { username: string; avatar_path: string | null } | null;
};

type LogInfo = { owner: string; item: string };
type ListInfo = { title: string; items: Thumb[] };

type ItemRow = {
  title: string;
  image_url: string | null;
  image_hidden: boolean;
};

type ListQueryRow = {
  id: string;
  title: string;
  list_items: { items: ItemRow | null }[];
};

function toThumb(item: ItemRow): Thumb {
  return { title: item.title, image_url: shownImage(item) };
}

type NotificationsState = {
  loaded: boolean;
  signedIn: boolean;
  error: string;
  rows: NotificationRow[];
  logs: Record<string, LogInfo>;
  items: Record<string, Thumb>;
  lists: Record<string, ListInfo>;
  owners: Record<string, string>;
  adminIds: Set<string>;
  myId: string;
  // When the data arrived, which is what the times on the cards count from
  loadedAt: number;
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
  const [state, setState] = useState<NotificationsState>({
    loaded: false,
    signedIn: false,
    error: "",
    rows: [],
    logs: {},
    items: {},
    lists: {},
    owners: {},
    adminIds: new Set(),
    myId: "",
    loadedAt: 0,
  });
  const {
    loaded,
    signedIn,
    error,
    rows,
    logs,
    items,
    lists,
    owners,
    adminIds,
    myId,
    loadedAt,
  } = state;

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setState((previous) => ({ ...previous, loaded: true }));
        return;
      }
      const userId = userData.user.id;
      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id, type, read, created_at, log_id, list_id, comment_id, list_comment_id, actor_id, body, profiles!notifications_actor_fkey(username, avatar_path)",
        )
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        setState((previous) => ({
          ...previous,
          loaded: true,
          signedIn: true,
          error: error.message,
        }));
        return;
      }
      const list = (data ?? []) as unknown as NotificationRow[];
      // The entries these refer to, then their items and owners
      const logIds = [
        ...new Set(list.map((n) => n.log_id).filter((v): v is string => !!v)),
      ];
      const listIds = [
        ...new Set(list.map((n) => n.list_id).filter((v): v is string => !!v)),
      ];

      const logRes = logIds.length
        ? await supabase
            .from("logs")
            .select("id, user_id, item_id")
            .in("id", logIds)
        : { data: [] as { id: string; user_id: string; item_id: string }[] };
      const logRows = logRes.data ?? [];

      const itemIds = [...new Set(logRows.map((l) => l.item_id))];
      const ownerIds = [...new Set(logRows.map((l) => l.user_id))];

      // Everyone who could be named on a card, to badge the admins among them.
      // Notices from the moderators have no actor.
      const actorIds = list.flatMap((n) => (n.actor_id ? [n.actor_id] : []));
      const peopleIds = [...new Set([...actorIds, ...ownerIds])];

      const [itemRes, listRes, profs, admins] = await Promise.all([
        itemIds.length
          ? supabase
              .from("items")
              .select("id, title, image_url, image_hidden")
              .in("id", itemIds)
          : Promise.resolve({ data: [] as (ItemRow & { id: string })[] }),
        listIds.length
          ? supabase
              .from("lists")
              .select(
                "id, title, list_items(position, items(title, image_url, image_hidden))",
              )
              .in("id", listIds)
              .order("position", { referencedTable: "list_items" })
              .limit(MOSAIC_SIZE, { referencedTable: "list_items" })
          : Promise.resolve({ data: [] as ListQueryRow[] }),
        ownerIds.length
          ? supabase.from("profiles").select("id, username").in("id", ownerIds)
          : Promise.resolve({ data: [] as { id: string; username: string }[] }),
        peopleIds.length
          ? supabase.from("admins").select("user_id").in("user_id", peopleIds)
          : Promise.resolve({ data: [] as { user_id: string }[] }),
      ]);

      // Publish the notifications and all their display data together.
      setState({
        loaded: true,
        signedIn: true,
        error: "",
        rows: list,
        logs: Object.fromEntries(
          logRows.map((l) => [l.id, { owner: l.user_id, item: l.item_id }]),
        ),
        items: Object.fromEntries(
          (itemRes.data ?? []).map((v) => [v.id, toThumb(v)]),
        ),
        lists: Object.fromEntries(
          ((listRes.data ?? []) as unknown as ListQueryRow[]).map((v) => [
            v.id,
            {
              title: v.title,
              items: v.list_items.flatMap((e) =>
                e.items ? [toThumb(e.items)] : [],
              ),
            },
          ]),
        ),
        owners: Object.fromEntries(
          (profs.data ?? []).map((p) => [p.id, p.username]),
        ),
        adminIds: new Set((admins.data ?? []).map((a) => a.user_id)),
        myId: userId,
        loadedAt: Date.now(),
      });

      // Opening the page marks everything as read
      if (list.some((n) => !n.read)) {
        await supabase
          .from("notifications")
          .update({ read: true })
          .eq("recipient_id", userId)
          .eq("read", false);
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
