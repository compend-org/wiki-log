// ABOUTME: The "In Lists" section of an item page.
// ABOUTME: Shows the lists that include the item as cards, most recently added first.

import { loadMoreItemLists } from "@/app/itemPagesActions";
import CardPages from "@/components/CardPages";
import { renderItemListCards } from "@/components/loadItemPages";
import type { ItemListRow } from "@/lib/itemLists";
import type { Keyset } from "@/lib/paging";
import type { ViewerState } from "@/lib/viewerState";

export default function ItemLists({
  itemId,
  lists,
  next,
  error,
  viewerId,
  viewer,
}: {
  itemId: string;
  // The first page of lists, and where the next one starts
  lists: ItemListRow[];
  next: Keyset | null;
  error: string;
  viewerId: string | undefined;
  viewer: ViewerState;
}) {
  if (error) {
    return <p className="text-danger">{error}</p>;
  }

  return (
    <section className="flex w-full flex-col gap-3">
      <h2 className="text-xl font-bold">
        {lists.length === 0 ? "Not in any lists yet" : "In Lists"}
      </h2>
      <CardPages
        first={{
          cards: renderItemListCards(lists, viewerId, viewer),
          next,
          error,
        }}
        loadMore={loadMoreItemLists.bind(null, itemId)}
      />
    </section>
  );
}
