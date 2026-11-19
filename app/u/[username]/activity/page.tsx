// ABOUTME: Someone's activity: their diary, and the reviews and lists they have liked.
// ABOUTME: Laid out like your own activity page, but its cards have no edit or delete buttons.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import {
  loadMoreProfileDiary,
  loadMoreProfileLikes,
} from "@/app/profileActivityActions";
import { loadDiaryPage } from "@/components/activity/loadDiaryPage";
import { loadLikesPage } from "@/components/activity/loadLikesPage";
import CardPages from "@/components/paging/CardPages";
import { pageMetadata } from "@/lib/metadata";
import { getProfileByName } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  await connection();
  const { username } = await params;
  const profile = await getProfileByName(username);
  if (!profile) return {};
  return pageMetadata({ title: `${profile.username}'s activity` });
}

export default async function ProfileActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const t = await getTranslations();
  await connection();
  const { username } = await params;
  const { tab } = await searchParams;
  const profile = await getProfileByName(username);
  if (!profile) notFound();

  const active = tab === "likes" ? "likes" : "diary";
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId: string | undefined = claimsData?.claims?.sub;
  // Your own activity has its own page, with the buttons
  if (viewerId === profile.id) {
    redirect(active === "likes" ? "/activity?tab=likes" : "/activity");
  }

  const profileHref = `/u/${encodeURIComponent(profile.username)}`;
  const tabs = [
    { id: "diary", label: t("profile.diary"), href: `${profileHref}/activity` },
    {
      id: "likes",
      label: t("profile.likes"),
      href: `${profileHref}/activity?tab=likes`,
    },
  ] as const;
  const view = { viewerId, ownerName: profile.username };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <Link href={profileHref} className="text-sm text-muted">
        {t("profile.backTo", { name: profile.username })}
      </Link>
      <h1 className="text-center text-3xl font-bold">
        {t("profile.activityOf", { name: profile.username })}
      </h1>

      <nav aria-label={t("nav.activity")} className="flex gap-2">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            aria-current={active === t.id ? "page" : undefined}
            className={`flex-1 border-2 px-4 py-2 text-center hover:no-underline ${
              active === t.id
                ? "border-dashed border-accent text-foreground"
                : "border-transparent text-muted hover:border-line"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-col gap-3">
        <p className="hidden py-8 text-center text-muted only:block">
          {active === "likes"
            ? t("pages.activity.emptyOthersLikes")
            : t("common.nothingHereYet")}
        </p>
        {active === "likes" ? (
          <CardPages
            key={`likes:${profile.id}`}
            first={await loadLikesPage(supabase, profile.id, {}, view)}
            loadMore={loadMoreProfileLikes.bind(null, profile.username)}
          />
        ) : (
          <CardPages
            key={`diary:${profile.id}`}
            first={await loadDiaryPage(supabase, profile.id, {}, view)}
            loadMore={loadMoreProfileDiary.bind(null, profile.username)}
          />
        )}
      </div>
    </main>
  );
}
