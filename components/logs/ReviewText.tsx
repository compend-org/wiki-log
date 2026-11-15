import Link from "next/link";
import { REVIEW_LINK } from "@/lib/format";

// The colour of item links and mentions, in reviews, comments and drafts
export const LINK_COLOR = "text-[#1a5fd0] [[data-theme=dark]_&]:text-[#6ea8ff]";

// Shows a review, turning item links and mentions into real links. Put it inside the
// element that holds the text. With `plain`, the links are only underlined
// (for places where a link can't be clicked, like tooltips). Otherwise the
// text sits above a card's full-card link, so it can be selected while the
// space around it still opens the card.
export default function ReviewText({
  text,
  plain = false,
}: {
  text: string;
  plain?: boolean;
}) {
  const parts: React.ReactNode[] = [];
  let last = 0;

  for (const m of text.matchAll(REVIEW_LINK)) {
    const start = m.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    // A mention's id is the person's, after an @
    const isMention = m[1].startsWith("@");
    const label = isMention ? `@${m[2]}` : m[2];
    parts.push(
      plain ? (
        <span key={start} className={LINK_COLOR}>
          {label}
        </span>
      ) : (
        <Link
          key={start}
          href={isMention ? `/people/${m[1].slice(1)}` : `/item/${m[1]}`}
          // A mention's address only redirects, so there's nothing to prefetch
          prefetch={isMention ? false : undefined}
          className={`relative z-10 hover:underline ${LINK_COLOR}`}
        >
          {label}
        </Link>
      ),
    );
    last = start + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return plain ? (
    parts
  ) : (
    <span className="card-text relative z-10">{parts}</span>
  );
}
