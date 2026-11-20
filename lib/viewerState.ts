// ABOUTME: Reads, in one request, what the viewer has liked, shared, blocked and hidden
// ABOUTME: among the reviews, lists and comments a page is showing.
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseSfwMode, type SfwMode } from "@/lib/sfw";

export type ViewerState = {
  likedLogs: Set<string>;
  sharedLogs: Set<string>;
  likedLists: Set<string>;
  sharedLists: Set<string>;
  likedComments: Set<string>;
  likedListComments: Set<string>;
  // Everyone the viewer has blocked, not only the authors on the page
  blocked: Set<string>;
  // Every item the viewer has hidden, not only the ones on the page
  hiddenItems: Set<string>;
  // How the viewer wants adult content shown; "off" when signed out
  sfwMode: SfwMode;
};

type ViewerStateRow = {
  liked_logs: string[];
  shared_logs: string[];
  liked_lists: string[];
  shared_lists: string[];
  liked_comments: string[];
  liked_list_comments: string[];
  blocked: string[];
  hidden_items: string[];
  sfw_mode: string;
};

// The viewer's state for these review, list and comment ids. Different for
// each person, so never cached. Signed out, it is empty and nothing is asked.
// Signed in, it is asked even with no ids, since what the viewer blocked,
// hid and chose for adult content applies to everything on the page.
export async function getViewerState(
  supabase: SupabaseClient,
  viewerId: string | undefined,
  ids: {
    logIds?: string[];
    listIds?: string[];
    commentIds?: string[];
    listCommentIds?: string[];
  },
): Promise<ViewerState> {
  const logIds = ids.logIds ?? [];
  const listIds = ids.listIds ?? [];
  const commentIds = ids.commentIds ?? [];
  const listCommentIds = ids.listCommentIds ?? [];

  let row: ViewerStateRow | null = null;
  if (viewerId) {
    const { data } = await supabase.rpc("viewer_state", {
      p_log_ids: logIds,
      p_list_ids: listIds,
      p_comment_ids: commentIds,
      p_list_comment_ids: listCommentIds,
    });
    row = data as ViewerStateRow | null;
  }

  return {
    likedLogs: new Set(row?.liked_logs),
    sharedLogs: new Set(row?.shared_logs),
    likedLists: new Set(row?.liked_lists),
    sharedLists: new Set(row?.shared_lists),
    likedComments: new Set(row?.liked_comments),
    likedListComments: new Set(row?.liked_list_comments),
    blocked: new Set(row?.blocked),
    hiddenItems: new Set(row?.hidden_items),
    sfwMode: parseSfwMode(row?.sfw_mode),
  };
}
