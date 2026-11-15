// ABOUTME: Page links for a long list: previous, next, and numbered pages with gaps.
// ABOUTME: Renders links on the list page and buttons in the list editor.
import Link from "next/link";
import type { ReactNode } from "react";
import { pagerPages } from "@/lib/listPages";

type Props = {
  page: number;
  last: number;
  // Each page's URL, for links
  href?: (page: number) => string;
  // Or what to do when a page is picked, for buttons
  onPage?: (page: number) => void;
  disabled?: boolean;
};

const BASE = "min-w-9 rounded-lg border px-2 py-1 text-center text-sm";

function PageControl({
  target,
  label,
  current,
  href,
  onPage,
  disabled,
  children,
}: {
  target: number;
  label: string;
  current: boolean;
  href?: (page: number) => string;
  onPage?: (page: number) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const className = `${BASE} ${
    current
      ? "border-accent bg-accent text-background"
      : "border-line hover:border-accent"
  }`;
  if (current) {
    return (
      <span aria-current="page" className={className}>
        {children}
      </span>
    );
  }
  if (href) {
    return (
      <Link href={href(target)} aria-label={label} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onPage?.(target)}
      aria-label={label}
      disabled={disabled}
      className={`${className} disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

export default function ListPager({
  page,
  last,
  href,
  onPage,
  disabled,
}: Props) {
  if (last <= 1) return null;
  const common = { href, onPage, disabled };

  return (
    <nav aria-label="Pages of this list" className="flex flex-wrap gap-1.5">
      {page > 1 && (
        <PageControl
          target={page - 1}
          label="Previous page"
          current={false}
          {...common}
        >
          ‹
        </PageControl>
      )}
      {pagerPages(page, last).map((p, i) =>
        p === null ? (
          // Gaps never move, so their place in the row identifies them
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          <span key={`gap-${i}`} className="px-1 py-1 text-sm text-muted">
            …
          </span>
        ) : (
          <PageControl
            key={p}
            target={p}
            label={`Page ${p}`}
            current={p === page}
            {...common}
          >
            {p}
          </PageControl>
        ),
      )}
      {page < last && (
        <PageControl
          target={page + 1}
          label="Next page"
          current={false}
          {...common}
        >
          ›
        </PageControl>
      )}
    </nav>
  );
}
