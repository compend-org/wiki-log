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
// each person, so never cached. Signed out, it is empty and nothing is asked.
export async function getViewerState(
  supabase: SupabaseClient,
  viewerId: string | undefined,
  ids: { logIds?: string[]; listIds?: string[]; commentIds?: string[] },
): Promise<ViewerState> {
  let row: ViewerStateRow | null = null;
  if (viewerId) {
    const { data } = await supabase.rpc("viewer_state", {
      p_log_ids: ids.logIds ?? [],
      p_list_ids: ids.listIds ?? [],
      p_comment_ids: ids.commentIds ?? [],
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
