// ABOUTME: Loads the paged sections about one item a page at a time, rendered as cards:
// ABOUTME: the lists that include it, and the reviews of it that one person liked.
import type { CardsPage } from "@/components/CardPages";
import ItemLogCard from "@/components/ItemLogCard";
import ListCard from "@/components/ListCard";
import { getAdminIds } from "@/lib/admin";
import { getItemLists, type ItemListRow } from "@/lib/itemLists";
import { getItemLogsLikedBy } from "@/lib/itemLogs";
import type { Keyset } from "@/lib/paging";
import { createClient } from "@/lib/supabase/server";
import { getViewerState, type ViewerState } from "@/lib/viewerState";

export function renderItemListCards(
  lists: ItemListRow[],
  viewerId: string | undefined,
  viewer: ViewerState,
) {
  return lists.map((l) => ({
    key: l.id,
    card: (
      <ListCard
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
    ),
  }));
}

// The database client for this request, and who is looking
async function requestViewer() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, viewerId: data?.claims?.sub as string | undefined };
}

// A later page of the lists that include an item, for the server action
export async function loadItemListsPage(
  itemId: string,
  after: Keyset,
): Promise<CardsPage> {
  const { supabase, viewerId: id } = await requestViewer();
  const { lists, next, error } = await getItemLists(itemId, after);
  const viewer = await getViewerState(supabase, id, {
    listIds: lists.map((l) => l.id),
  });
  return { cards: renderItemListCards(lists, id, viewer), next, error };
}

// A page of the reviews of an item that one person liked
export async function loadLikedReviewsPage(
  itemId: string,
  userId: string,
  after: Keyset | null,
): Promise<CardsPage> {
  const renderedAt = Date.now();
  const { supabase, viewerId: id } = await requestViewer();
  const { rows, next, error } = await getItemLogsLikedBy(itemId, userId, after);
  const [viewer, adminIds] = await Promise.all([
    getViewerState(supabase, id, { logIds: rows.map((r) => r.id) }),
    getAdminIds(),
  ]);
  return {
    // Reviews by people the viewer has blocked aren't shown
    cards: rows
      .filter((r) => !viewer.blocked.has(r.user_id))
      .map((row) => ({
        key: row.id,
        card: (
          <ItemLogCard
            row={row}
            isAdmin={adminIds.has(row.user_id)}
            renderedAt={renderedAt}
            viewerId={id}
            viewer={viewer}
          />
        ),
      })),
    next,
    error,
  };
}
