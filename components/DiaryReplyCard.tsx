// ABOUTME: One of your replies in your diary: who you replied to, where, and what you said.
// ABOUTME: The whole card opens the review or list it was written on.
import Link from "next/link";
import ReviewText from "@/components/ReviewText";

export default function DiaryReplyCard({
    ago,
    href,
    replyingTo,
    where,
    body,
}: {
    // When it was written, as shown: "5m ago", or the date once it's a day old
    ago: string;
    // The review or list it was written on
    href: string;
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
            <p className="text-xs text-muted">
                {ago} · You replied
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
            <Link href={href} className="relative z-10 w-fit font-semibold">
                {where}
            </Link>
            <p className="line-clamp-3 whitespace-pre-wrap break-words border-l-2 border-dashed border-line pl-3 text-sm">
                <ReviewText text={body} />
            </p>
        </div>
    );
}