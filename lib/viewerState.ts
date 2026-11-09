// ABOUTME: Reads, in one request, what the viewer has liked, shared and blocked
// ABOUTME: among the reviews, lists and comments a page is showing.
import type { SupabaseClient } from "@supabase/supabase-js";

export type ViewerState = {
  likedLogs: Set<string>;
  sharedLogs: Set<string>;
  likedLists: Set<string>;
  sharedLists: Set<string>;
  likedComments: Set<string>;
  // Everyone the viewer has blocked, not only the authors on the page
  blocked: Set<string>;
};

type ViewerStateRow = {
  liked_logs: string[];
  shared_logs: string[];
  liked_lists: string[];
  shared_lists: string[];
  liked_comments: string[];
  blocked: string[];
};

// The viewer's state for these review, list and comment ids. Different for
// each person, so never cached. Signed out, or with no ids to look up, it is
// empty and nothing is asked: with nothing on the page there's no one to hide.
export async function getViewerState(
  supabase: SupabaseClient,
  viewerId: string | undefined,
  ids: { logIds?: string[]; listIds?: string[]; commentIds?: string[] },
): Promise<ViewerState> {
  const logIds = ids.logIds ?? [];
  const listIds = ids.listIds ?? [];
  const commentIds = ids.commentIds ?? [];

  let row: ViewerStateRow | null = null;
  if (viewerId && logIds.length + listIds.length + commentIds.length > 0) {
    const { data } = await supabase.rpc("viewer_state", {
      p_log_ids: logIds,
      p_list_ids: listIds,
      p_comment_ids: commentIds,
    });
    row = data as ViewerStateRow | null;
  }

  return {
    likedLogs: new Set(row?.liked_logs),
    sharedLogs: new Set(row?.shared_logs),
    likedLists: new Set(row?.liked_lists),
    sharedLists: new Set(row?.shared_lists),
    likedComments: new Set(row?.liked_comments),
    blocked: new Set(row?.blocked),
  };
}
