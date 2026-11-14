// ABOUTME: The signed-in person's activity: their diary, and the reviews and lists they have liked.
// ABOUTME: Loads the first page of the open tab on the server; later pages load as you scroll.
import Link from "next/link";
import { connection } from "next/server";
import { loadMoreDiary } from "@/app/diaryActions";
import { loadMoreLikes } from "@/app/likesActions";
import CardPages from "@/components/CardPages";
import { loadDiaryPage } from "@/components/loadDiaryPage";
import { loadLikesPage } from "@/components/loadLikesPage";
import { loginHref } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

const TABS = [
  { id: "diary", label: "Diary", href: "/activity" },
  { id: "likes", label: "Likes", href: "/activity?tab=likes" },
] as const;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await connection();
  const { tab } = await searchParams;
  const active = tab === "likes" ? "likes" : "diary";
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return (
      <main className="p-8 text-center">
        <Link href={loginHref("/activity")} className="underline">
          Sign in to see your activity
        </Link>
      </main>
    );
  }

  return (
    // A different account starts over, rather than keeping the last one's pages
    <main
      key={userId}
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8"
    >
      <h1 className="text-3xl font-bold text-center">Activity</h1>

      <nav aria-label="Activity" className="flex gap-27">
        {TABS.map((t) => (
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
        {active === "likes" ? (
          <>
            {/* Shows while nothing else is here */}
            <p className="hidden py-8 text-center text-muted only:block">
              Nothing liked yet. Like a review or a list and it will show up
              here.
            </p>
            <CardPages
              key="likes"
              first={await loadLikesPage(supabase, userId, {})}
              loadMore={loadMoreLikes}
            />
          </>
        ) : (
          <>
            {/* Shows while nothing else is here, including once the last
                entry is deleted */}
            <p className="hidden py-8 text-center text-muted only:block">
              Nothing here yet. Log something, or make a list.
            </p>
            <CardPages
              key="diary"
              first={await loadDiaryPage(supabase, userId, {})}
              loadMore={loadMoreDiary}
            />
          </>
        )}
      </div>
    </main>
  );
}
