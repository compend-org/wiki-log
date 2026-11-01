import Link from "next/link";

export default function LoadMore({ href }: { href: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className="self-center rounded-lg border border-line px-4 py-2 text-sm text-muted hover:border-accent hover:text-foreground"
    >
      Load more
    </Link>
  );
}