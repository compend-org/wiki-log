// ABOUTME: The row of other reviews of the same item that a reviewer liked.
// ABOUTME: Shows as many as fit, with a heading that opens the page listing all of them.
import Link from "next/link";
import Avatar from "@/components/Avatar";
import TextLinesIcon from "@/components/icons/TextLinesIcon";
import Stars from "@/components/Stars";
import type { AlsoLikedEntry } from "@/lib/alsoLiked";

// How many show at each width: 4 on phones, 6 from `sm`
const BASE = 4;
const SM = 6;

export default function AlsoLiked({
  likes,
  username,
  allHref,
}: {
  likes: AlsoLikedEntry[];
  username: string;
  // The page that lists every one of them
  allHref: string;
}) {
  if (likes.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <Link
        href={allHref}
        className="flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-muted no-underline hover:text-foreground"
      >
        Liked by {username}
        <span aria-hidden="true" className="text-xl leading-none">
          ›
        </span>
      </Link>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
        {likes.slice(0, SM).map((p, i) => (
          <Link
            key={p.logId}
            href={`/u/${encodeURIComponent(p.username)}/${p.logId}`}
            prefetch={false}
            aria-label={`${p.username}'s review, ${p.rating} out of 5 stars${
              p.hasText ? ", with text" : ""
            }`}
            title={`${p.username}'s review`}
            className={`${
              i >= BASE ? "hidden sm:flex" : "flex"
            } flex-col items-center gap-1 text-foreground no-underline hover:opacity-80`}
          >
            <span className="relative">
              <Avatar name={p.username} path={p.avatarPath} size={56} />
              {p.hasText && (
                <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-muted text-background">
                  <TextLinesIcon size={11} />
                </span>
              )}
            </span>
            <Stars rating={p.rating} className="text-xs" />
          </Link>
        ))}
      </div>
    </section>
  );
}
