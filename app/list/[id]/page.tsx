import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import AdminBadge from "@/components/AdminBadge";
import Comments, { type CommentItem } from "@/components/Comments";
import ItemImage from "@/components/ItemImage";
import ListLikeButton from "@/components/ListLikeButton";
import ReportButton from "@/components/ReportButton";
import ReviewText from "@/components/ReviewText";
import ShareButton from "@/components/ShareButton";
import Stars from "@/components/Stars";
import { isAdmin } from "@/lib/admin";
import { isUuid } from "@/lib/ids";
import { getSharedSet } from "@/lib/shares";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type ListRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  ranked: boolean;
  profiles: { username: string } | null;
  list_likes: { count: number }[];
  shares: { count: number }[];
};

type EntryRow = {
  item_id: string;
  items: { title: string; image_url: string | null } | null;
};

type CommentQueryRow = {
  id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  user_id: string;
  profiles: { username: string } | null;
};

type OwnerLog = {
  id: string;
  item_id: string;
  rating: number | null;
  review: string;
  logged_at: string;
};

// Keeps the tooltip on screen: the first column's opens to the right, the last
// column's to the left, and the rest are centred. The grid has 3 columns on
// phones and 4 from the sm breakpoint up.
function tooltipPosition(index: number): string {
  const base =
    index % 3 === 0
      ? "left-0"
      : index % 3 === 2
        ? "right-0"
        : "left-1/2 -translate-x-1/2";
  const wide =
    index % 4 === 0
      ? "sm:left-0 sm:right-auto sm:translate-x-0"
      : index % 4 === 3
        ? "sm:left-auto sm:right-0 sm:translate-x-0"
        : "sm:left-1/2 sm:right-auto sm:-translate-x-1/2";
  return `${base} ${wide}`;
}

export default async function ListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();

  const { data } = await supabase
    .from("lists")
    .select(
      "id, user_id, title, description, ranked, profiles!lists_user_id_profiles_fkey(username), list_likes(count), shares(count)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const list = data as unknown as ListRow;

  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId: string | undefined = claimsData?.claims?.sub;
  const isOwner = viewerId === list.user_id;

  const { data: entryData } = await supabase
    .from("list_items")
    .select("item_id, items(title, image_url)")
    .eq("list_id", id)
    .order("position");
  const entries = (entryData ?? []) as unknown as EntryRow[];

  // The list owner's own logs for the items on this list, newest first, so the
  // first one we meet for each item is their most recent
  const itemIds = entries.map((e) => e.item_id);
  const ownerLatest = new Map<string, { latest: OwnerLog; count: number }>();
  if (itemIds.length > 0) {
    const { data: logData } = await supabase
      .from("logs")
      .select("id, item_id, rating, review, logged_at")
      .eq("user_id", list.user_id)
      .in("item_id", itemIds)
      .order("logged_at", { ascending: false });
    for (const l of (logData ?? []) as unknown as OwnerLog[]) {
      const current = ownerLatest.get(l.item_id);
      if (current) current.count += 1;
      else ownerLatest.set(l.item_id, { latest: l, count: 1 });
    }
  }

  let liked = false;
  if (viewerId) {
    const { data: likeRow } = await supabase
      .from("list_likes")
      .select("list_id")
      .eq("user_id", viewerId)
      .eq("list_id", id)
      .maybeSingle();
    liked = Boolean(likeRow);
  }

  const sharedSet = await getSharedSet(supabase, viewerId, "list", [id]);
  const { data: commentData } = await supabase
    .from("list_comments")
    .select(
      "id, parent_id, body, created_at, user_id, profiles!list_comments_user_id_profiles_fkey(username)",
    )
    .eq("list_id", id)
    .order("created_at", { ascending: true });

  const comments: CommentItem[] = (
    (commentData ?? []) as unknown as CommentQueryRow[]
  ).map((c) => ({
    id: c.id,
    parentId: c.parent_id,
    body: c.body,
    date: c.created_at.slice(0, 10),
    authorId: c.user_id,
    authorName: c.profiles?.username ?? "Someone",
    authorIsAdmin: isAdmin(c.user_id),
    likeCount: 0,
    liked: false,
  }));

  const owner = list.profiles?.username;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{list.title}</h1>
        <p className="text-sm text-muted">
          A {list.ranked ? "ranked " : ""}list by{" "}
          {isAdmin(list.user_id) && (
            <>
              {" "}
              <AdminBadge />
            </>
          )}{" "}
          {owner ? (
            <Link
              href={`/u/${encodeURIComponent(owner)}`}
              className="underline"
            >
              {owner}
            </Link>
          ) : (
            "someone"
          )}{" "}
          · {entries.length} {entries.length === 1 ? "item" : "items"}
        </p>
        {list.description && (
          <p className="mt-2 whitespace-pre-wrap">{list.description}</p>
        )}
        <div className="mt-2 flex items-center gap-4">
          <ListLikeButton
            viewerId={viewerId ?? null}
            listId={id}
            ownerId={list.user_id}
            initialCount={list.list_likes?.[0]?.count ?? 0}
            initiallyLiked={liked}
          />
          <ShareButton
            viewerId={viewerId ?? null}
            ownerId={list.user_id}
            kind="list"
            targetId={id}
            initialCount={list.shares?.[0]?.count ?? 0}
            initiallyShared={sharedSet.has(id)}
          />
          <ReportButton
            viewerId={viewerId ?? null}
            ownerId={list.user_id}
            kind="list"
            targetId={id}
          />
          {isOwner && (
            <Link href={`/list/${id}/edit`} className="text-sm underline">
              Edit list
            </Link>
          )}
        </div>
      </header>

      {entries.length === 0 && (
        <p className="text-muted">This list is empty.</p>
      )}

      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {entries.map((entry, index) => {
          const title = entry.items?.title ?? "Unknown item";
          const info = ownerLatest.get(entry.item_id);

          return (
            <li key={entry.item_id} className="group relative">
              <Link
                href={`/item/${entry.item_id}`}
                className="flex flex-col gap-1"
              >
                <div className="relative">
                  <ItemImage
                    src={entry.items?.image_url}
                    alt={title}
                    className="aspect-square w-full rounded-lg"
                  />
                  {list.ranked && (
                    <span className="absolute left-1 top-1 rounded bg-background/80 px-1.5 text-sm font-bold text-accent">
                      {index + 1}
                    </span>
                  )}
                </div>
                <span className="truncate text-xs">{title}</span>
              </Link>

              {info && (
                <div
                  role="tooltip"
                  className={`card pointer-events-none absolute bottom-full z-30 mb-2 hidden w-64 max-w-[calc(100vw-2rem)] flex-col gap-1 p-3 text-left group-hover:flex group-focus-within:flex ${tooltipPosition(
                    index,
                  )}`}
                >
                  <span className="text-xs text-muted">
                    {owner ? `${owner}'s latest` : "Latest"} ·{" "}
                    {info.latest.logged_at.slice(0, 10)}
                  </span>
                  <Stars rating={info.latest.rating} />
                  {info.latest.review && (
                    <p className="line-clamp-8 whitespace-pre-wrap break-words text-sm">
                      {<ReviewText text={info.latest.review} plain />}
                    </p>
                  )}
                  {info.latest.rating === null && !info.latest.review && (
                    <p className="text-sm text-muted">
                      Logged, with no rating or review.
                    </p>
                  )}
                  {info.count > 1 && (
                    <span className="text-xs text-muted">
                      {info.count} entries
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Comments
        comments={comments}
        viewerId={viewerId ?? null}
        table="list_comments"
        scope={{ list_id: id }}
        ownerId={list.user_id}
      />
    </main>
  );
}
