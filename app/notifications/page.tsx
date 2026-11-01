"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type NotificationRow = {
  id: string;
  type: "like" | "comment" | "reply" | "follow";
  read: boolean;
  created_at: string;
  log_user_id: string | null;
  log_video_id: string | null;
  profiles: { username: string } | null;
};

export default function NotificationsPage() {
  const [loaded, setLoaded] = useState<boolean>(false);
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [myId, setMyId] = useState<string>("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoaded(true);
        return;
      }
      const userId = userData.user.id;
      setSignedIn(true);
      setMyId(userId);

      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id, type, read, created_at, log_user_id, log_video_id, profiles!notifications_actor_fkey(username)"
        )
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        setError(error.message);
        setLoaded(true);
        return;
      }
      const list = (data ?? []) as unknown as NotificationRow[];
      setRows(list);

      // Video titles and review-owner names, fetched in one go each
      const videoIds = [
        ...new Set(list.map((n) => n.log_video_id).filter((v): v is string => !!v)),
      ];
      const ownerIds = [
        ...new Set(list.map((n) => n.log_user_id).filter((v): v is string => !!v)),
      ];
      const [vids, profs] = await Promise.all([
        videoIds.length
          ? supabase.from("videos").select("id, title").in("id", videoIds)
          : Promise.resolve({ data: [] as { id: string; title: string }[] }),
        ownerIds.length
          ? supabase.from("profiles").select("id, username").in("id", ownerIds)
          : Promise.resolve({ data: [] as { id: string; username: string }[] }),
      ]);
      setTitles(Object.fromEntries((vids.data ?? []).map((v) => [v.id, v.title])));
      setOwners(Object.fromEntries((profs.data ?? []).map((p) => [p.id, p.username])));
      setLoaded(true);

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

  function describe(n: NotificationRow): { text: string; href: string } {
    const actor = n.profiles?.username ?? "Someone";
    const title = n.log_video_id ? titles[n.log_video_id] ?? "a video" : "";
    const ownerName = n.log_user_id ? owners[n.log_user_id] : undefined;
    const reviewHref =
      ownerName && n.log_video_id
        ? `/u/${encodeURIComponent(ownerName)}/${n.log_video_id}`
        : "/";

    switch (n.type) {
      case "like":
        return { text: `${actor} liked your review of ${title}`, href: reviewHref };
      case "comment":
        return {
          text: `${actor} commented on your review of ${title}`,
          href: reviewHref,
        };
      case "reply": {
        const whose = n.log_user_id === myId ? "your" : `${ownerName ?? "someone"}'s`;
        return {
          text: `${actor} replied to your comment on ${whose} review of ${title}`,
          href: reviewHref,
        };
      }
      case "follow":
        return {
          text: `${actor} started following you`,
          href: n.profiles
            ? `/u/${encodeURIComponent(n.profiles.username)}`
            : "/",
        };
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Notifications</h1>

      {!loaded && <p className="text-muted">Loading…</p>}

      {loaded && !signedIn && (
        <Link href="/login" className="underline">
          Sign in to see your notifications
        </Link>
      )}

      {error && <p className="text-danger">{error}</p>}

      {loaded && signedIn && !error && rows.length === 0 && (
        <p className="text-muted">
          Nothing yet. You&apos;ll see likes, comments, replies and new
          followers here.
        </p>
      )}

      {rows.map((n) => {
        const { text, href } = describe(n);
        return (
          <Link
            key={n.id}
            href={href}
            className={`flex flex-col gap-1 rounded-lg border p-3 ${
              n.read ? "border-line" : "border-accent bg-surface"
            }`}
          >
            <span className="text-sm">{text}</span>
            <span className="text-xs text-muted">
              {n.created_at.slice(0, 10)}
            </span>
          </Link>
        );
      })}
    </main>
  );
}