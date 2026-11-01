import LogLinkForm from "@/components/LogLinkForm";
import Feed from "@/components/Feed";
import { parseLimit } from "@/lib/paging";

export const instant = false;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; limit?: string }>;
}) {
  const { tab, limit } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 p-4 sm:p-8">
      <LogLinkForm />
      <Feed
        tab={tab === "everyone" || tab === "following" ? tab : undefined}
        limit={parseLimit(limit)}
      />    </main>
  );
}