import { redirect } from "next/navigation";
import { connection } from "next/server";
import ListCreator from "@/components/lists/ListCreator";
import ListEditor from "@/components/lists/ListEditor";
import { FEATURES } from "@/lib/features";
import { addParam, fetchNewListItem } from "@/lib/lists/newListItem";
import { loginHref } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

// ?add=Q42 starts the list with that item, which is what "New list" in an
// item's "Add to list" sends
export default async function NewListPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string | string[] }>;
}) {
  await connection();
  const add = addParam((await searchParams).add);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    redirect(
      loginHref(add ? `/list/new?add=${encodeURIComponent(add)}` : "/list/new"),
    );
  }
  const entry = await fetchNewListItem(supabase, add);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      {FEATURES.groupedLists ? (
        <ListCreator firstItem={entry} />
      ) : (
        <ListEditor
          list={{ id: null, title: "", description: null, ranked: false }}
          ownerName=""
          initialItems={entry ? [{ ...entry, note: null }] : []}
        />
      )}
    </main>
  );
}
