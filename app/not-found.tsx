// ABOUTME: The page for anything that doesn't exist, shown inside the site's layout.
// ABOUTME: Drawn as a review of the error, written by the site itself, so every 404 looks the same.

import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import ItemImage from "@/components/items/ItemImage";
import Stars from "@/components/logs/Stars";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Not found" };

// A log card like the ones in the feed, with the site as its author and the
// error as its item. Nothing on it is stored, so it needs no data.
export default function NotFound() {
  const t = useTranslations();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center p-4 sm:p-8">
      <div className="@container">
        <div className="card grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-3 @xl:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.2fr)]">
          <ItemImage
            src={null}
            alt={t("pages.notFound.alt")}
            placeholder="404"
            className="h-20 w-20 rounded"
          />

          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 hover:underline"
              >
                {/* biome-ignore lint/performance/noImgElement: a plain img is intended */}
                <img
                  src="/logo-light.png"
                  alt=""
                  width={16}
                  height={16}
                  className="avatar logo-light shrink-0 border-0 object-contain"
                />
                {/* biome-ignore lint/performance/noImgElement: a plain img is intended */}
                <img
                  src="/logo-dark.png"
                  alt=""
                  width={16}
                  height={16}
                  className="avatar logo-dark shrink-0 border-0 object-contain"
                />
                {SITE_NAME}.org
              </Link>
              <span>{t("logs.logged")}</span>
              <span className="whitespace-nowrap">· {t("time.justNow")}</span>
            </span>
            <h1 className="w-fit font-semibold">{t("pages.notFound.alt")}</h1>
            <Stars rating={0.5} />
          </div>

          <p className="col-span-2 text-sm @xl:col-span-1 @xl:border-l @xl:border-dashed @xl:border-line @xl:pl-4">
            {t.rich("pages.notFound.body", {
              home: (c) => (
                <Link href="/" className="underline">
                  {c}
                </Link>
              ),
            })}
          </p>
        </div>
      </div>
    </main>
  );
}
