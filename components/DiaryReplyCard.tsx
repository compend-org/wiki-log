// ABOUTME: One of your replies in your diary: who you replied to, where, and what you said.
// ABOUTME: The whole card opens the review or list it was written on; the cross deletes the reply.
import Link from "next/link";
import DeleteButton from "@/components/buttons/DeleteButton";
import ReviewText from "@/components/ReviewText";

export default function DiaryReplyCard({
  replyId,
  kind,
  cardKey,
  ago,
  href,
  isReply,
  replyingTo,
  where,
  body,
}: {
  replyId: string;
  // Whether it is a reply on a review or on a list
  kind: "comment" | "list_comment";
  // This card's key in the diary, so deleting the reply takes it off the page
  cardKey: string;
  // When it was written, as shown: "5m ago", or the date once it's a day old
  ago: string;
  // The review or list it was written on
  href: string;
  isReply: boolean;
  // Whose comment it answers, when that is known
  replyingTo: string | null;
  // What it was written on, such as "Alice's review of Dune"
  where: string;
  body: string;
}) {
  return (
    <div className="card relative flex flex-col gap-1 p-3 hover-or-tap:border-accent/60">
      {/* The whole card opens it, except the links above it */}
      <Link
        href={href}
        aria-label={`Open ${where}`}
        className="absolute inset-0 rounded-[inherit]"
      />
      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <p>
          {ago} · You {isReply ? "replied" : "commented"}
          {replyingTo && (
            <>
              {" to "}
              <Link
                href={`/u/${encodeURIComponent(replyingTo)}`}
                className="relative z-10 hover:underline"
              >
                {replyingTo}
              </Link>
            </>
          )}
        </p>
        <DeleteButton kind={kind} targetId={replyId} cardKey={cardKey} />
      </div>
      <Link href={href} className="relative z-10 w-fit font-semibold">
        {where}
      </Link>
      <p className="line-clamp-3 whitespace-pre-wrap break-words border-l-2 border-dashed border-line pl-3 text-sm">
        <ReviewText text={body} />
      </p>
    </div>
  );
}
