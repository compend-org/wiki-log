// ABOUTME: A card summarising one list: its author, title, item thumbnails and social counts.
// ABOUTME: Shown wherever lists appear among other content, such as feeds and item pages.
import Link from "next/link";
import AdminBadge from "@/components/AdminBadge";
import Avatar from "@/components/Avatar";
import ListLikeButton from "@/components/ListLikeButton";
import ListPreview from "@/components/ListPreview";
import ShareButton from "@/components/ShareButton";
import ShareIcon from "@/components/ShareIcon";
import { getAdminIds } from "@/lib/admin";
import type { ListRow, Thumb } from "@/lib/feedData";
import { commentLabel, sharedLabel } from "@/lib/format";

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
  sharers?: string[];
  // Whether to say "made a list" after the author, as an activity feed does
  showActivity?: boolean;
}) {
  const author = l.profiles?.username;
  const avatarPath = l.profiles?.avatar_path ?? null;
  const itemCount = l.list_items?.[0]?.count ?? 0;
  const adminIds = await getAdminIds();

  return (
    <div className="card relative flex flex-col gap-2 p-3 hover:border-accent/60">
      <Link
        href={`/list/${l.id}`}
        aria-label={`Open the list ${l.title}`}
        className="absolute inset-0 rounded-[inherit]"
      />
      {sharers.length > 0 && (
        <span className="flex items-center gap-1 text-xs text-muted">
          <ShareIcon className="h-3.5 w-3.5" />
          {sharedLabel(sharers)}
        </span>
      )}
      <span className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
        {author ? (
          <Link
            href={`/u/${encodeURIComponent(author)}`}
            className="relative z-10 inline-flex items-center gap-1.5 hover:underline"
          >
            <Avatar name={author} path={avatarPath} size={16} />
            {author}
          </Link>
        ) : (
          <span>Someone</span>
        )}
        {adminIds.has(l.user_id) && <AdminBadge />}
        {showActivity && <span>made a {l.ranked ? "ranked " : ""}list</span>}
      </span>
      <span className="font-semibold">{l.title}</span>
      {preview.length > 0 && (
        <ListPreview
          thumbs={preview}
          total={itemCount}
          href={`/list/${l.id}`}
        />
      )}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>
          {new Date(l.created_at).toLocaleDateString()} · {itemCount}{" "}
          {itemCount === 1 ? "item" : "items"}
        </span>
        <span className="relative z-10">
          <ListLikeButton
            viewerId={viewerId ?? null}
            listId={l.id}
            ownerId={l.user_id}
            initialCount={l.list_likes?.[0]?.count ?? 0}
            initiallyLiked={liked}
          />
        </span>
        <span className="relative z-10">
          <ShareButton
            viewerId={viewerId ?? null}
            ownerId={l.user_id}
            kind="list"
            targetId={l.id}
            initialCount={l.shares?.[0]?.count ?? 0}
            initiallyShared={shared}
          />
        </span>
        <Link
          href={`/list/${l.id}#comments`}
          className="relative z-10 hover:underline"
        >
          {commentLabel(l.list_comments?.[0]?.count ?? 0)}
        </Link>
      </div>
    </div>
  );
}
