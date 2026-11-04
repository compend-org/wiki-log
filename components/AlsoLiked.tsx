import Link from "next/link";
import Avatar from "@/components/Avatar";
import Stars from "@/components/Stars";
import type { AlsoLikedEntry } from "@/lib/alsoLiked";
import HeartIcon from "./HeartIcon";

const MAX = 3;

export default function AlsoLiked({
  likes,
  username,
}: {
  likes: AlsoLikedEntry[];
  username: string;
}) {
  if (likes.length === 0) return null;

  const shown = likes.slice(0, MAX);
  const extra = likes.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-muted">
      <span
        title="Liked these reviews of the same item"
        className="inline-flex items-center gap-1"
      >
        {username} liked:
      </span>
      {shown.map((p) => (
        <Link
          key={p.logId}
          href={`/u/${encodeURIComponent(p.username)}/${p.logId}`}
          aria-label={`${p.username}'s review, ${p.rating} out of 5 stars`}
          title={`${p.username}'s review`}
          className="flex flex-col items-center gap-1 text-foreground no-underline hover:opacity-80"
        >
          <Avatar name={p.username} path={p.avatarPath} size={32} />
          <Stars rating={p.rating} className="text-xs" />
        </Link>
      ))}
      {extra > 0 && <span>+{extra}</span>}
    </div>
  );
}
