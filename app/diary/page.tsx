// ABOUTME: The signed-in person's diary: everything they logged and every list they made, newest first.
// ABOUTME: Loads the first page on the server, so it arrives complete; later pages load as you scroll.
import Link from "next/link";
import { connection } from "next/server";
import { loadMoreDiary } from "@/app/diaryActions";
import CardPages from "@/components/CardPages";
import { loadDiaryPage } from "@/components/loadDiaryPage";
import { loginHref } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function DiaryPage() {
  await connection();
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return (
      <main className="p-8 text-center">
        <Link href={loginHref("/diary")} className="underline">
          Sign in to see your diary
        </Link>
      </main>
    );
  }

  const first = await loadDiaryPage(supabase, userId, {});

  return (
    // A different account starts over, rather than keeping the last one's pages
    <main
      key={userId}
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8"
    >
      <h1 className="text-3xl font-bold">Diary</h1>

      <div className="flex flex-col gap-3">
        {/* Shows while nothing else is here, including once the last entry
            is deleted */}
        <p className="hidden py-8 text-center text-muted only:block">
          Nothing here yet. Log something, or make a list.
        </p>
        <CardPages first={first} loadMore={loadMoreDiary} />
      </div>
    </main>
  );
}
