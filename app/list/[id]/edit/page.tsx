import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import GroupedListEditor from "@/components/lists/GroupedListEditor";
import ListEditor, { type ListEntry } from "@/components/lists/ListEditor";
import { FEATURES } from "@/lib/features";
import { isUuid } from "@/lib/ids";
import { draftGroupsFrom } from "@/lib/lists/listGroups";
import {
  fetchGroupedEntries,
  fetchGroups,
  fetchListPage,
  pageCount,
  parsePage,
} from "@/lib/lists/listPages";
import { loginHref } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type ListRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  ranked: boolean;
  grouped: boolean;
  group_labels: boolean;
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
      "id, user_id, title, description, ranked, grouped, group_labels, profiles!lists_user_id_profiles_fkey(username)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const list = data as unknown as ListRow;

  // Only the owner edits
  if (list.user_id !== viewerId) redirect(`/list/${id}`);

  // A grouped list (at most 300 items) is edited whole, in its groups
  if (list.grouped && FEATURES.groupedLists) {
    const [groups, { entries: all, error }] = await Promise.all([
      fetchGroups(supabase, id),
      fetchGroupedEntries(supabase, id),
    ]);
    if (error) throw new Error(error);
    const draftGroups = draftGroupsFrom(groups, all);
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
        <GroupedListEditor
          key={JSON.stringify([
            list.title,
            list.description,
            draftGroups.map((g) => [
              g.key,
              g.name,
              g.items.map((i) => [i.itemId, i.imageUrl]),
            ]),
          ])}
          list={{
            id: list.id,
            title: list.title,
            description: list.description,
            labeled: list.group_labels,
          }}
          ownerName={list.profiles?.username ?? ""}
          initialGroups={draftGroups}
        />
      </main>
    );
  }

  // Lists can be longer than one response carries, so they're edited a page
  // at a time
  const { entries, total } = await fetchListPage(supabase, id, page);
  const lastPage = pageCount(total);
  if (page > lastPage) redirect(`/list/${id}/edit?page=${lastPage}`);

  const initialItems: ListEntry[] = entries.map((e) => ({
    itemId: e.itemId,
    title: e.title,
    imageUrl: e.imageUrl,
    note: e.note,
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
    initialItems.map((i) => [i.itemId, i.imageUrl, i.note]),
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
          grouped: list.grouped,
        }}
        ownerName={list.profiles?.username ?? ""}
        initialItems={initialItems}
        initialPage={page}
        initialTotal={total}
      />
    </main>
  );
}
