// ABOUTME: A card summarising one list: its author, title, item thumbnails and social counts.
// ABOUTME: Shown wherever lists appear among other content, such as feeds and item pages.
import Link from "next/link";
import { connection } from "next/server";
import CardActions from "@/components/CardActions";
import ListLikeButton from "@/components/ListLikeButton";
import ListPreview from "@/components/ListPreview";
import ShareButton from "@/components/ShareButton";
import ShareIcon from "@/components/ShareIcon";
import UserName from "@/components/UserName";
import type { ListRow, Thumb } from "@/lib/feedData";
import { timeAgo } from "@/lib/format";
import SharedLabel, { type Sharer } from "./SharedLabel";

export default async function ListCard({
  list: l,
  thumbs: preview,
  viewerId,
  liked,
  shared,
  sharers = [],
  showActivity = true,
}: {
  list: ListRow;
  thumbs: Thumb[];
  viewerId: string | undefined;
  liked: boolean;
  shared: boolean;
  // The people to credit for sharing this list, newest first
  sharers?: Sharer[];
  // Whether to say "made a list" after the author, as an activity feed does
  showActivity?: boolean;
}) {
  await connection();
  const renderedAt = Date.now();
  const author = l.profiles?.username;
  const avatarPath = l.profiles?.avatar_path ?? null;
  const itemCount = l.list_items?.[0]?.count ?? 0;

  return (
    <div className="card relative flex flex-col gap-2 p-3 hover:border-accent/60">
      <Link
        href={`/list/${l.id}`}
        aria-label={`Open the list ${l.title}`}
        className="absolute inset-0 rounded-[inherit]"
      />
      {sharers.length > 0 && (
        <span className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
          <ShareIcon className="h-3.5 w-3.5" />
          <SharedLabel sharers={sharers} />
        </span>
      )}
      <span className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
        <UserName
          userId={l.user_id}
          username={author}
          avatarPath={avatarPath}
        />
        {showActivity && <span>made a {l.ranked ? "ranked " : ""}list</span>}
        <span className="whitespace-nowrap">
          · {timeAgo(l.created_at, renderedAt)}
        </span>
      </span>
      <span className="font-semibold">{l.title}</span>
      {preview.length > 0 && (
        <ListPreview
          thumbs={preview}
          total={itemCount}
          href={`/list/${l.id}`}
        />
      )}
      <CardActions
        like={
          <ListLikeButton
            viewerId={viewerId ?? null}
            listId={l.id}
            ownerId={l.user_id}
            initialCount={l.list_likes?.[0]?.count ?? 0}
            initiallyLiked={liked}
          />
        }
        share={
          <ShareButton
            viewerId={viewerId ?? null}
            ownerId={l.user_id}
            kind="list"
            targetId={l.id}
            initialCount={l.shares?.[0]?.count ?? 0}
            initiallyShared={shared}
          />
        }
        commentHref={`/list/${l.id}#comments`}
        commentCount={l.list_comments?.[0]?.count ?? 0}
      >
        {itemCount} {itemCount === 1 ? "item" : "items"}
      </CardActions>
    </div>
  );
}
