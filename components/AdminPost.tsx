// ABOUTME: Shows a review, list or comment on the admin reports pages as plain text.
// ABOUTME: Never loads images, and can clamp long posts so the queue stays easy to scan.
import Link from "next/link";
import {
  type AdminPost as Post,
  type PostKind,
  postHref,
} from "@/lib/adminReports";
import { plainReview, timeAgo } from "@/lib/format";

const KIND_LABELS: Record<PostKind, string> = {
  log: "Review",
  list: "List",
  comment: "Comment",
  list_comment: "List comment",
};

export default function AdminPost({
  kind,
  post,
  now,
  clamp = false,
}: {
  kind: PostKind;
  post: Post;
  now: number;
  clamp?: boolean;
}) {
  if (!post.exists) {
    return (
      <p className="text-sm text-muted">
        {KIND_LABELS[kind]} has since been deleted
      </p>
    );
  }

  const href = postHref(post);
  const text = post.body ? plainReview(post.body).trim() : "";
  const titles = post.item_titles ?? [];
  const hiddenTitles = (post.item_count ?? 0) - titles.length;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted">
        <span>{KIND_LABELS[kind]}</span>
        {post.title &&
          (href ? (
            <Link
              href={href}
              prefetch={false}
              className="font-medium text-foreground hover:underline"
            >
              {post.title}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{post.title}</span>
          ))}
        {post.rating != null && <span>{post.rating}★</span>}
        {post.at && <span>{timeAgo(post.at, now)}</span>}
        {post.removed_at && (
          <span className="font-medium text-danger">
            Removed {timeAgo(post.removed_at, now)}
          </span>
        )}
      </p>
      {text ? (
        <p
          className={`whitespace-pre-wrap break-words ${clamp ? "line-clamp-3" : ""}`}
        >
          {text}
        </p>
      ) : (
        kind === "log" && <p className="text-sm text-muted">No written text</p>
      )}
      {titles.length > 0 && (
        <p className={`text-sm text-muted ${clamp ? "line-clamp-2" : ""}`}>
          {titles.join(" · ")}
          {hiddenTitles > 0 && ` · and ${hiddenTitles} more`}
        </p>
      )}
    </div>
  );
}
