"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
    | "list_share";
  read: boolean;
  created_at: string;
  log_id: string | null;
  list_id: string | null;
  profiles: { username: string } | null;
};

type LogInfo = { owner: string; item: string };

type NotificationsState = {
  loaded: boolean;
  signedIn: boolean;
  error: string;
  rows: NotificationRow[];
  logs: Record<string, LogInfo>;
  titles: Record<string, string>;
  listTitles: Record<string, string>;
  owners: Record<string, string>;
  myId: string;
};

export default function NotificationsPage() {
  const loginHref = useLoginHref();
  const [state, setState] = useState<NotificationsState>({
    loaded: false,
    signedIn: false,
    error: "",
    rows: [],
    logs: {},
    titles: {},
    listTitles: {},
    owners: {},
    myId: "",
  });
  const {
    loaded,
    signedIn,
    error,
    rows,
    logs,
    titles,
    listTitles,
    owners,
    myId,
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
          "id, type, read, created_at, log_id, list_id, profiles!notifications_actor_fkey(username)",
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

      const [items, lists, profs] = await Promise.all([
        itemIds.length
          ? supabase.from("items").select("id, title").in("id", itemIds)
          : Promise.resolve({ data: [] as { id: string; title: string }[] }),
        listIds.length
          ? supabase.from("lists").select("id, title").in("id", listIds)
          : Promise.resolve({ data: [] as { id: string; title: string }[] }),
        ownerIds.length
          ? supabase.from("profiles").select("id, username").in("id", ownerIds)
          : Promise.resolve({ data: [] as { id: string; username: string }[] }),
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
        titles: Object.fromEntries(
          (items.data ?? []).map((v) => [v.id, v.title]),
        ),
        listTitles: Object.fromEntries(
          (lists.data ?? []).map((v) => [v.id, v.title]),
        ),
        owners: Object.fromEntries(
          (profs.data ?? []).map((p) => [p.id, p.username]),
        ),
        myId: userId,
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

  // `rest` is everything after the username
  function describe(n: NotificationRow): { rest: string; href: string } {
    const entry = n.log_id ? logs[n.log_id] : undefined;
    const title = entry ? (titles[entry.item] ?? "an item") : "an item";
    const ownerName = entry ? owners[entry.owner] : undefined;
    const reviewHref =
      ownerName && n.log_id
        ? `/u/${encodeURIComponent(ownerName)}/${n.log_id}`
        : "/";
    const listTitle = n.list_id ? (listTitles[n.list_id] ?? "a list") : "";
    const listHref = n.list_id ? `/list/${n.list_id}#comments` : "/";

    switch (n.type) {
      case "like":
        return {
          rest: ` liked your review of ${title}`,
          href: reviewHref,
        };
      case "comment":
        return {
          rest: ` commented on your review of ${title}`,
          href: reviewHref,
        };
      case "reply": {
        const whose =
          entry?.owner === myId ? "your" : `${ownerName ?? "someone"}'s`;
        return {
          rest: ` replied to your comment on ${whose} review of ${title}`,
          href: reviewHref,
        };
      }
      case "follow":
        return {
          rest: " started following you",
          href: n.profiles
            ? `/u/${encodeURIComponent(n.profiles.username)}`
            : "/",
        };
      case "share":
        return {
          rest: ` shared your review of ${title}`,
          href: reviewHref,
        };
      case "list_share":
        return {
          rest: ` shared your list “${listTitle}”`,
          href: n.list_id ? `/list/${n.list_id}` : "/",
        };
      case "list_like":
        return {
          rest: ` liked your list “${listTitle}”`,
          href: n.list_id ? `/list/${n.list_id}` : "/",
        };
      case "list_comment":
        return {
          rest: ` commented on your list “${listTitle}”`,
          href: listHref,
        };
      case "list_reply":
        return {
          rest: ` replied to your comment on the list “${listTitle}”`,
          href: listHref,
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
          Nothing yet. You&apos;ll see likes, shares, comments, replies and new
          followers here.
        </p>
      )}

      {rows.map((n) => {
        const { rest, href } = describe(n);
        const actor = n.profiles?.username;
        return (
          <div
            key={n.id}
            className={`relative flex flex-col gap-1 border p-3 hover:border-accent/60 ${
              n.read ? "border-line" : "border-accent bg-surface"
            }`}
          >
            <Link
              href={href}
              aria-label={`${actor ?? "Someone"}${rest}`}
              className="absolute inset-0"
            />
            <span className="text-sm">
              {actor ? (
                <Link
                  href={`/u/${encodeURIComponent(actor)}`}
                  className="relative z-10 font-semibold hover:underline"
                >
                  {actor}
                </Link>
              ) : (
                "Someone"
              )}
              {rest}
            </span>
            <span className="text-xs text-muted">
              {n.created_at.slice(0, 10)}
            </span>
          </div>
        );
      })}
    </main>
  );
}
