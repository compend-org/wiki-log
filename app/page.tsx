import Link from "next/link";
import { connection } from "next/server";
import ItemSearch from "@/components/ItemSearch";
import Feed from "@/components/Feed";
import { createClient } from "@/lib/supabase/server";
import { parseLimit } from "@/lib/paging";
import { SITE_NAME } from "@/lib/site";

export const instant = false;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; limit?: string }>;
}) {
  await connection();
  const { tab, limit } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-4 sm:p-8">
      {!signedIn && (
        <section className="flex flex-col gap-2 border border-line bg-surface p-4">
          <p className="text-2xl font-bold">{SITE_NAME}</p>
          <p className="text-sm">
            <Link
              href="/login"
              className="text-accent underline hover:no-underline"
            >
              Create an account
            </Link>{" "}
            or{" "}
            <Link
              href="/search"
              className="text-accent underline hover:no-underline"
            >
              browse
            </Link>
            .
          </p>
        </section>
      )}

      <ItemSearch />
      <Feed
        tab={tab === "everyone" || tab === "following" ? tab : undefined}
        limit={parseLimit(limit)}
      />
    </main>
  );
}