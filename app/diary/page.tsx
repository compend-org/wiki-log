"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import EditEntryForm from "@/components/EditEntryForm";
import DeleteIcon from "@/components/icons/DeleteIcon";
import ItemImage from "@/components/icons/ItemImage";
import LoadMore from "@/components/LoadMore";
import ReviewText from "@/components/ReviewText";
import Stars from "@/components/Stars";
import { track } from "@/lib/analytics";
import { PAGE_SIZE } from "@/lib/paging";
import { createClient } from "@/lib/supabase/client";
import { useLoginHref } from "@/lib/useLoginHref";

type Thumb = { title: string; imageUrl: string | null };

type LogEntry = {
  kind: "log";
  id: string;
  date: string;
  itemId: string;
  title: string;
  imageUrl: string | null;
  rating: number | null;
  review: string;
};

type ListEntry = {
  kind: "list";
  id: string;
  date: string;
  title: string;
  ranked: boolean;
  count: number;
  previews: Thumb[];
};

type Entry = LogEntry | ListEntry;

type LogRow = {
  id: string;
  item_id: string;
  rating: number | null;
  review: string;
  logged_at: string;
  items: { title: string; image_url: string | null } | null;
};

type ListRow = {
  id: string;
  title: string;
  ranked: boolean;
  created_at: string;
  list_items: { count: number }[];
};

type PreviewRow = {
  list_id: string;
  position: number;
  items: { title: string; image_url: string | null } | null;
};

// The same small controls sit at the top right of every card
const actionClass = "text-xs text-accent underline hover:no-underline";

export default function DiaryPage() {
  const loginHref = useLoginHref();
  const [ready, setReady] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(PAGE_SIZE);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  // The log whose edit form is open
  const [editingId, setEditingId] = useState<string | null>(null);

  // Who is signed in, and their username (for links to their entries)
  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUserId(data.user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", data.user.id)
          .maybeSingle();
        setUsername(profile?.username ?? null);
      }
      setReady(true);
    }
    loadUser();
  }, []);

  // Their logs and lists, newest first
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      const supabase = createClient();

      const [logsRes, listsRes] = await Promise.all([
        supabase
          .from("logs")
          .select(
            "id, item_id, rating, review, logged_at, items(title, image_url)",
          )
          .eq("user_id", userId)
          .order("logged_at", { ascending: false })
          .limit(limit + 1),
        supabase
          .from("lists")
          .select("id, title, ranked, created_at, list_items(count)")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit + 1),
      ]);
      if (cancelled) return;

      if (logsRes.error || listsRes.error) {
        setError(logsRes.error?.message ?? listsRes.error?.message ?? "");
        setLoaded(true);
        return;
      }

      const logs = (logsRes.data ?? []) as unknown as LogRow[];
      const lists = (listsRes.data ?? []) as unknown as ListRow[];

      const logEntries: LogEntry[] = logs.map((l) => ({
        kind: "log",
        id: l.id,
        date: l.logged_at,
        itemId: l.item_id,
        title: l.items?.title ?? "Unknown item",
        imageUrl: l.items?.image_url ?? null,
        rating: l.rating === null ? null : Number(l.rating),
        review: l.review,
      }));

      const listEntries: ListEntry[] = lists.map((l) => ({
        kind: "list",
        id: l.id,
        date: l.created_at,
        title: l.title,
        ranked: l.ranked,
        count: l.list_items?.[0]?.count ?? 0,
        previews: [],
      }));

      // The newest `limit` of the combined list always sit within the newest
      // `limit` of each, so merging and trimming is exact
      const merged: Entry[] = [...logEntries, ...listEntries].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      const shown = merged.slice(0, limit);

      // A few pictures from each list that is on screen
      const shownLists = shown.filter((e): e is ListEntry => e.kind === "list");
      if (shownLists.length > 0) {
        const { data: previewData } = await supabase
          .from("list_items")
          .select("list_id, position, items(title, image_url)")
          .in(
            "list_id",
            shownLists.map((l) => l.id),
          )
          .lte("position", 4)
          .order("position");
        if (cancelled) return;

        const byList = new Map<string, Thumb[]>();
        for (const row of (previewData ?? []) as unknown as PreviewRow[]) {
          const arr = byList.get(row.list_id) ?? [];
          arr.push({
            title: row.items?.title ?? "Unknown item",
            imageUrl: row.items?.image_url ?? null,
          });
          byList.set(row.list_id, arr);
        }
        for (const l of shownLists) {
          l.previews = (byList.get(l.id) ?? []).slice(0, 4);
        }
      }

      setEntries(shown);
      setHasMore(merged.length > limit);
      setLoaded(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, limit]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this entry?")) return;
    const { error } = await createClient().from("logs").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    track("log_deleted");
    setEntries((prev) =>
      prev.filter((e) => !(e.kind === "log" && e.id === id)),
    );
  }

  async function handleDeleteList(id: string) {
    if (
      !window.confirm(
        "Delete this list? Its likes and comments are deleted with it, and this can't be undone.",
      )
    ) {
      return;
    }
    const { data, error } = await createClient()
      .from("lists")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) {
      setError(error.message);
      return;
    }
    // Row-level security refuses silently when the list isn't yours
    if (!data || data.length === 0) {
      setError("Couldn't delete that list.");
      return;
    }
    track("list_deleted");
    setEntries((prev) =>
      prev.filter((e) => !(e.kind === "list" && e.id === id)),
    );
  }

  if (!ready) {
    return <main className="p-8 text-center text-muted">Loading…</main>;
  }

  if (!userId) {
    return (
      <main className="p-8 text-center">
        <Link href={loginHref} className="underline">
          Sign in to see your diary
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Diary</h1>

      {error && <p className="text-danger">{error}</p>}

      {!loaded && <p className="py-8 text-center text-muted">Loading…</p>}

      {loaded && !error && entries.length === 0 && (
        <p className="py-8 text-center text-muted">
          Nothing here yet. Log something, or make a list.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {entries.map((e) => {
          const date = new Date(e.date).toLocaleDateString();

          if (e.kind === "list") {
            return (
              <li key={`list-${e.id}`} className="card flex flex-col gap-2 p-3">
                <div className="flex items-center justify-between gap-3 text-xs text-muted">
                  <span>
                    {date} · You made a {e.ranked ? "ranked " : ""}list
                  </span>
                  <span className="flex items-center gap-3">
                    <Link href={`/list/${e.id}/edit`} className={actionClass}>
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeleteList(e.id)}
                      aria-label="Delete this list"
                      title="Delete this list"
                      className="flex text-danger hover:opacity-70"
                    >
                      <DeleteIcon className="h-4 w-4" />
                    </button>
                  </span>
                </div>
                <Link
                  href={`/list/${e.id}`}
                  className="w-fit font-semibold underline"
                >
                  {e.title}
                </Link>
                {e.previews.length > 0 && (
                  <div className="flex gap-1">
                    {e.previews.map((p, i) => (
                      <ItemImage
                        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed-order list whose entries can repeat
                        key={i}
                        src={p.imageUrl}
                        alt={p.title}
                        className="h-14 w-14 rounded"
                      />
                    ))}
                  </div>
                )}
                <span className="text-xs text-muted">
                  {e.count} {e.count === 1 ? "item" : "items"}
                </span>
              </li>
            );
          }

          const entryHref = username
            ? `/u/${encodeURIComponent(username)}/${e.id}`
            : null;

          return (
            <li key={`log-${e.id}`} className="card flex flex-col gap-2 p-3">
              <div className="flex items-center justify-between gap-3 text-xs text-muted">
                <span>
                  {entryHref ? (
                    <Link href={entryHref} className="underline">
                      {date}
                    </Link>
                  ) : (
                    date
                  )}
                  {" · You logged"}
                </span>
                <span className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingId(e.id)}
                    className={actionClass}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(e.id)}
                    aria-label="Delete this entry"
                    title="Delete this entry"
                    className="flex text-danger hover:opacity-70"
                  >
                    <DeleteIcon className="h-4 w-4" />
                  </button>
                </span>
              </div>

              {editingId === e.id ? (
                <EditEntryForm
                  logId={e.id}
                  initialRating={e.rating}
                  initialReview={e.review}
                  onCancel={() => setEditingId(null)}
                  onSaved={(rating, review) => {
                    setEntries((prev) =>
                      prev.map((x) =>
                        x.kind === "log" && x.id === e.id
                          ? { ...x, rating, review }
                          : x,
                      ),
                    );
                    setEditingId(null);
                  }}
                />
              ) : (
                <div className="flex items-center gap-3">
                  <Link href={`/item/${e.itemId}`} className="shrink-0">
                    <ItemImage
                      src={e.imageUrl}
                      alt={e.title}
                      className="h-16 w-16 rounded"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <Link
                      href={`/item/${e.itemId}`}
                      className="w-fit font-semibold"
                    >
                      {e.title}
                    </Link>
                    <Stars rating={e.rating} />
                    {e.review && (
                      <p className="line-clamp-2 whitespace-pre-wrap break-words text-sm">
                        {<ReviewText text={e.review} />}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <LoadMore
          key={entries.length}
          onLoad={() => setLimit((l) => l + PAGE_SIZE)}
        />
      )}
    </main>
  );
}
