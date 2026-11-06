// ABOUTME: The "In Lists" section of an item page.
// ABOUTME: Shows the lists that include the item as cards, most recently added first.

import ListCard from "@/components/ListCard";
import { LIST_SELECT, type ListRow, loadPreviews } from "@/lib/feedData";
import { createClient } from "@/lib/supabase/server";
import { getViewerState } from "@/lib/viewerState";

// How many lists to show for one item
const MAX_LISTS = 12;

export default async function ItemLists({ itemId }: { itemId: string }) {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId: string | undefined = claimsData?.claims?.sub;

  const { data, error } = await supabase
    .from("list_items")
    .select(`lists(${LIST_SELECT})`)
    .eq("item_id", itemId)
    .order("added_at", { ascending: false })
    .limit(MAX_LISTS);

  if (error) {
    return <p className="text-danger">{error.message}</p>;
  }

  const lists = (
    (data ?? []) as unknown as { lists: ListRow | null }[]
  ).flatMap((r) => (r.lists ? [r.lists] : []));
  const [previews, viewer] = await Promise.all([
    loadPreviews(supabase, lists),
    getViewerState(supabase, viewerId, { listIds: lists.map((l) => l.id) }),
  ]);

  return (
    <section className="flex w-full flex-col gap-3">
      <h2 className="text-xl font-bold">
        {lists.length === 0 ? "Not in any lists yet" : "In Lists"}
      </h2>
      {lists.map((l) => (
        <ListCard
          key={l.id}
          list={l}
          thumbs={previews[l.id] ?? []}
          viewerId={viewerId}
          liked={viewer.likedLists.has(l.id)}
          shared={viewer.sharedLists.has(l.id)}
          showActivity={false}
        />
      ))}
    </section>
  );
}
