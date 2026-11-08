import Link from "next/link";
import Avatar from "@/components/Avatar";
import Stars from "@/components/Stars";
import type { AlsoLikedEntry } from "@/lib/alsoLiked";

// How many show at each width: 3 on phones, 5 from `sm`, 6 from `md`
const BASE = 3;
const SM = 5;
const MD = 6;

export default function AlsoLiked({
  likes,
  username,
}: {
  likes: AlsoLikedEntry[];
  username: string;
}) {
  if (likes.length === 0) return null;

  const shown = likes.slice(0, MD);
  // How many are left out at a width that shows `n`
  const extra = (n: number) => Math.max(0, likes.length - n);

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-muted">
      <span
        title="Liked these reviews of the same item"
        className="inline-flex items-center gap-1"
      >
        {username} liked:
      </span>
      {shown.map((p, i) => (
        <Link
          key={p.logId}
          href={`/u/${encodeURIComponent(p.username)}/${p.logId}`}
          prefetch={false}
          aria-label={`${p.username}'s review, ${p.rating} out of 5 stars`}
          title={`${p.username}'s review`}
          className={`${
            i >= SM ? "hidden md:flex" : i >= BASE ? "hidden sm:flex" : "flex"
          } flex-col items-center gap-1 text-foreground no-underline hover:opacity-80`}
        >
          <Avatar name={p.username} path={p.avatarPath} size={32} />
          <Stars rating={p.rating} className="text-xs" />
        </Link>
      ))}
      {extra(BASE) > 0 && <span className="sm:hidden">+{extra(BASE)}</span>}
      {extra(SM) > 0 && (
        <span className="hidden sm:inline md:hidden">+{extra(SM)}</span>
      )}
      {extra(MD) > 0 && <span className="hidden md:inline">+{extra(MD)}</span>}
    </div>
  );
}
