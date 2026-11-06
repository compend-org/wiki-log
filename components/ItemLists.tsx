// ABOUTME: The "In Lists" section of an item page.
// ABOUTME: Shows the lists that include the item as cards, most recently added first.

import ListCard from "@/components/ListCard";
import { LIST_SELECT, type ListRow, type Thumb } from "@/lib/feedData";
import { createClient } from "@/lib/supabase/server";
import { getViewerState } from "@/lib/viewerState";

// How many lists to show for one item
const MAX_LISTS = 12;

// How many of each list's first items to show on its card
const PREVIEW_ITEMS = 12;

type PreviewRow = { position: number; items: Thumb | null };

export default async function ItemLists({ itemId }: { itemId: string }) {
  const supabase = await createClient();

  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId: string | undefined = claimsData?.claims?.sub;

  const { data, error } = await supabase
    .from("list_items")
    .select(
      `lists(${LIST_SELECT}, preview:list_items(position, items(title, image_url)))`,
    )
    .eq("item_id", itemId)
    .lte("lists.preview.position", PREVIEW_ITEMS)
    .order("added_at", { ascending: false })
    .order("position", { referencedTable: "lists.preview" })
    .limit(MAX_LISTS);

  if (error) {
    return <p className="text-danger">{error.message}</p>;
  }

  const lists = (
    (data ?? []) as unknown as {
      lists: (ListRow & { preview: PreviewRow[] }) | null;
    }[]
  ).flatMap((r) => (r.lists ? [r.lists] : []));
  const viewer = await getViewerState(supabase, viewerId, {
    listIds: lists.map((l) => l.id),
  });

  return (
    <section className="flex w-full flex-col gap-3">
      <h2 className="text-xl font-bold">
        {lists.length === 0 ? "Not in any lists yet" : "In Lists"}
      </h2>
      {lists.map((l) => (
        <ListCard
          key={l.id}
          list={l}
          thumbs={l.preview.map((p) => ({
            title: p.items?.title ?? "Unknown item",
            image_url: p.items?.image_url ?? null,
          }))}
          viewerId={viewerId}
          liked={viewer.likedLists.has(l.id)}
          shared={viewer.sharedLists.has(l.id)}
          showActivity={false}
        />
      ))}
    </section>
  );
}
