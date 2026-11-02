import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/ids";
import ItemImage from "@/components/ItemImage";
import Comments, { type CommentItem } from "@/components/Comments";
import ListLikeButton from "@/components/ListLikeButton";

export const instant = false;

type ListRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  ranked: boolean;
  profiles: { username: string } | null;
  list_likes: { count: number }[];
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
      "id, user_id, title, description, ranked, profiles!lists_user_id_profiles_fkey(username), list_likes(count)"
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

  const { data: commentData } = await supabase
    .from("list_comments")
    .select(
      "id, parent_id, body, created_at, user_id, profiles!list_comments_user_id_profiles_fkey(username)"
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
          return (
            <li key={entry.item_id}>
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

            </li>


          );
        })}
      </ul>
      <ListLikeButton
        viewerId={viewerId ?? null}
        listId={id}
        ownerId={list.user_id}
        initialCount={list.list_likes?.[0]?.count ?? 0}
        initiallyLiked={liked}
      />

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