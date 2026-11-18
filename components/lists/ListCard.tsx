// ABOUTME: A card summarising one list: its author, title, item thumbnails and social counts.
// ABOUTME: Shown wherever lists appear among other content, such as feeds and item pages.
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import ListLikeButton from "@/components/lists/ListLikeButton";
import ListPreview from "@/components/lists/ListPreview";
import CardActions from "@/components/logs/CardActions";
import SharedLabel, { type Sharer } from "@/components/logs/SharedLabel";
import UserName from "@/components/people/UserName";
import ShareButton from "@/components/social/ShareButton";
import ShareIcon from "@/components/social/ShareIcon";
import type { ListRow, Thumb } from "@/lib/feed/feedData";
import { timeAgo } from "@/lib/format";
import { fetchGroupPreviews } from "@/lib/lists/groupPreview";
import { listCardTime } from "@/lib/lists/listCardTime";
import { itemsLabel, shownGroups } from "@/lib/lists/listGroups";
import { createClient } from "@/lib/supabase/server";

export default async function ListCard({
  list: l,
  thumbs: preview,
  viewerId,
  liked,
  shared,
  sharers = [],
  showActivity = true,
  showAuthor = true,
  controls,
  topControls,
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
  // Whether to name the author, which a page about that person doesn't need
  showAuthor?: boolean;
  // Extra controls beside the title, such as Pin
  controls?: ReactNode;
  topControls?: ReactNode;
}) {
  await connection();
  const renderedAt = Date.now();
  const author = l.profiles?.username;
  const avatarPath = l.profiles?.avatar_path ?? null;
  const itemCount = l.list_items?.[0]?.count ?? 0;
  // How many groups a grouped list has; null for a plain one
  const groups = shownGroups(l);
  const kind = groups !== null ? "grouped " : l.ranked ? "ranked " : "";
  const { bumped, time } = listCardTime(l, showActivity);
  // A grouped list's preview shows several of its groups, so it needs the
  // groups and their first items, not just the list's first ones
  const groupPreviews =
    groups !== null
      ? await fetchGroupPreviews(await createClient(), l.id)
      : null;

  return (
    <div className="card relative flex flex-col gap-2 p-3 hover-or-tap:border-accent/60">
      <Link
        href={`/list/${l.id}`}
        aria-label={`Open the list ${l.title}`}
        className="card-link absolute inset-0 rounded-[inherit]"
      />
      {sharers.length > 0 && (
        <span className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
          <ShareIcon className="h-3.5 w-3.5" />
          <SharedLabel sharers={sharers} />
        </span>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
          {showAuthor && (
            <>
              <UserName
                userId={l.user_id}
                username={author}
                avatarPath={avatarPath}
              />
              {showActivity && (
                <span>
                  {bumped ? "added to their" : "made a"} {kind}list
                </span>
              )}
            </>
          )}
          {!showAuthor && kind && (
            <span>{kind === "grouped " ? "Grouped" : "Ranked"} list ·</span>
          )}
          <span className="whitespace-nowrap">
            {showAuthor && "· "}
            {timeAgo(time, renderedAt)}
          </span>
        </span>
        {topControls}
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 line-clamp-2 [overflow-wrap:anywhere] font-semibold">
          {l.title}
        </span>
        {controls}
      </div>
      {preview.length > 0 && (
        <ListPreview
          thumbs={preview}
          total={itemCount}
          groups={groupPreviews}
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
            shareCount={l.shares?.[0]?.count ?? 0}
            shared={shared}
          />
        }
        commentHref={`/list/${l.id}#comments`}
        commentCount={l.list_comments?.[0]?.count ?? 0}
      >
        {itemsLabel(itemCount, groups)}
      </CardActions>
    </div>
  );
}
