import Link from "next/link";
import { REVIEW_LINK } from "@/lib/format";

// Shows a review, turning item links into real links. Put it inside the
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
    parts.push(
      plain ? (
        <span
          key={start}
          className="text-[#1a5fd0] [[data-theme=dark]_&]:text-[#6ea8ff]"
        >
          {m[2]}
        </span>
      ) : (
        <Link
          key={start}
          href={`/item/${m[1]}`}
          className="relative z-10 text-[#1a5fd0] hover:underline [[data-theme=dark]_&]:text-[#6ea8ff]"
        >
          {m[2]}
        </Link>
      ),
    );
    last = start + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return plain ? parts : <span className="relative z-10">{parts}</span>;
}
