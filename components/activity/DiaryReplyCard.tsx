// ABOUTME: One of your replies in your diary: who you replied to, where, and what you said.
// ABOUTME: The whole card opens the review or list it was written on; the cross deletes the reply.
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import DeleteButton from "@/components/logs/DeleteButton";
import ReviewText from "@/components/logs/ReviewText";

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
  owner,
  ownerHref,
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
  owner?: string;
  // Where the owner's name links to, when it should (in the feed it is the
  // commenter's profile)
  ownerHref?: string;
}) {
  const t = useTranslations();
  const action = {
    kind: isReply ? "replied" : "commented",
    who: owner ? "other" : "you",
    name: owner ?? "",
  };
  const author = (name: ReactNode) =>
    ownerHref ? (
      <Link href={ownerHref} className="relative z-10 hover:underline">
        {name}
      </Link>
    ) : (
      name
    );
  return (
    <div className="card relative flex flex-col gap-1 p-3 hover-or-tap:border-accent/60">
      {/* The whole card opens it, except the links above it */}
      <Link
        href={href}
        aria-label={t("activity.openWhere", { where })}
        className="card-link absolute inset-0 rounded-[inherit]"
      />
      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <p>
          {ago} ·{" "}
          {replyingTo
            ? t.rich("activity.replyTo", {
                ...action,
                author,
                replyingTo,
                user: (name) => (
                  <Link
                    href={`/u/${encodeURIComponent(replyingTo)}`}
                    className="relative z-10 hover:underline"
                  >
                    {name}
                  </Link>
                ),
              })
            : t.rich("activity.reply", { ...action, author })}
        </p>
        {!owner && (
          <DeleteButton kind={kind} targetId={replyId} cardKey={cardKey} />
        )}
      </div>
      <Link
        href={href}
        className="card-link relative z-10 w-fit block max-w-full min-w-0 line-clamp-2 [overflow-wrap:anywhere] font-semibold"
      >
        {where}
      </Link>
      <p className="line-clamp-3 whitespace-pre-wrap break-words border-l-2 border-dashed border-line pl-3 text-sm">
        <ReviewText text={body} />
      </p>
    </div>
  );
}
