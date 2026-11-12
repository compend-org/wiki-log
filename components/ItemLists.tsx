// ABOUTME: The "In Lists" section of an item page.
// ABOUTME: Shows the lists that include the item as cards, most recently added first.

import ListCard from "@/components/ListCard";
import LoadMore from "@/components/LoadMore";
import type { ItemListRow } from "@/lib/itemLists";
import type { ViewerState } from "@/lib/viewerState";

export default function ItemLists({
  lists,
  error,
  moreHref,
  viewerId,
  viewer,
}: {
  lists: ItemListRow[];
  error: string;
  // Where the next page of lists comes from, when there are more
  moreHref: string | null;
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
      {/* Keyed by its href, which changes when either section of the page
          loads more, so it watches again even if its own load was replaced */}
      {moreHref && <LoadMore key={moreHref} href={moreHref} />}
    </section>
  );
}
