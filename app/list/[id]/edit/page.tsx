import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import ListEditor, { type ListEntry } from "@/components/ListEditor";
import { isUuid } from "@/lib/ids";
import { fetchListPage, pageCount, parsePage } from "@/lib/listPages";
import { loginHref } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type ListRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  ranked: boolean;
  profiles: { username: string } | null;
};

export default async function EditListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  await connection();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const page = parsePage((await searchParams).page);

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId: string | undefined = claimsData?.claims?.sub;
  if (!viewerId) redirect(loginHref(`/list/${id}/edit`));

  const { data } = await supabase
    .from("lists")
    .select(
      "id, user_id, title, description, ranked, profiles!lists_user_id_profiles_fkey(username)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const list = data as unknown as ListRow;

  // Only the owner edits
  if (list.user_id !== viewerId) redirect(`/list/${id}`);

  // Lists can be longer than one response carries, so they're edited a page
  // at a time
  const { entries, total } = await fetchListPage(supabase, id, page);
  const lastPage = pageCount(total);
  if (page > lastPage) redirect(`/list/${id}/edit?page=${lastPage}`);

  const initialItems: ListEntry[] = entries.map((e) => ({
    itemId: e.itemId,
    title: e.title,
    imageUrl: e.imageUrl,
  }));

  // Visited pages stay mounted while hidden, and the editor works on its own
  // copy of the list. It starts over from the saved list when that has changed
  // since it was last shown, here or elsewhere. Its own changes don't redraw
  // this page, so they don't start it over.
  const savedKey = JSON.stringify([
    list.title,
    list.description,
    list.ranked,
    page,
    total,
    initialItems.map((i) => i.itemId),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <ListEditor
        key={savedKey}
        list={{
          id: list.id,
          title: list.title,
          description: list.description,
          ranked: list.ranked,
        }}
        ownerName={list.profiles?.username ?? ""}
        initialItems={initialItems}
        initialPage={page}
        initialTotal={total}
      />
    </main>
  );
}
