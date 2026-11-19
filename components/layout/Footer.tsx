import Link from "next/link";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import AdminFooterLink from "@/components/layout/AdminFooterLink";
import { FEATURES } from "@/lib/features";

export default function Footer() {
  const t = useTranslations();
  return (
    <footer className="sticky bottom-0 z-10 mt-auto border-t border-line bg-surface px-4 py-2 text-center text-xs text-muted sm:px-8">
      <nav
        aria-label={t("footer.label")}
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
      >
        <Link
          href="/privacy"
          prefetch={false}
          className="hover:text-foreground hover:underline"
        >
          {t("footer.privacy")}
        </Link>
        {FEATURES.leaderboards && (
          <Link
            href="/leaderboards"
            prefetch={false}
            className="hover:text-foreground hover:underline"
          >
            {t("footer.leaderboards")}
          </Link>
        )}
        <Link
          href="/guide"
          prefetch={false}
          className="hover:text-foreground hover:underline"
        >
          {t("footer.styleGuide")}
        </Link>
        <Link
          href="/contact"
          prefetch={false}
          className="hover:text-foreground hover:underline"
        >
          {t("footer.contact")}
        </Link>
        <Link
          href="/support"
          prefetch={false}
          className="hover:text-foreground hover:underline"
        >
          {t("footer.donate")}
        </Link>
        <Suspense fallback={null}>
          <AdminFooterLink />
        </Suspense>
      </nav>
    </footer>
  );
}
