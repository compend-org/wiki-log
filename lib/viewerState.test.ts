// ABOUTME: Tests for reading what the viewer has liked, shared and blocked.
// ABOUTME: Covers when the database is asked, and what comes back from it.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getViewerState } from "./viewerState";

function fakeSupabase() {
  const calls: { fn: string; args: unknown }[] = [];
  const client = {
    rpc: async (fn: string, args: unknown) => {
      calls.push({ fn, args });
      return {
        data: {
          liked_logs: ["log-1"],
          shared_logs: [],
          liked_lists: ["list-1"],
          shared_lists: [],
          liked_comments: [],
          blocked: ["person-1"],
        },
      };
    },
  };
  return { calls, supabase: client as unknown as SupabaseClient };
}

test("asks nothing for a signed-out visitor", async () => {
  const { calls, supabase } = fakeSupabase();
  const viewer = await getViewerState(supabase, undefined, {
    logIds: ["log-1"],
  });
  assert.equal(calls.length, 0);
  assert.equal(viewer.likedLogs.size, 0);
});

test("asks nothing when the page shows nothing to look up", async () => {
  const { calls, supabase } = fakeSupabase();
  const viewer = await getViewerState(supabase, "viewer-1", {
    logIds: [],
    listIds: [],
  });
  assert.equal(calls.length, 0);
  assert.equal(viewer.blocked.size, 0);
});

test("asks once for reviews and lists together", async () => {
  const { calls, supabase } = fakeSupabase();
  const viewer = await getViewerState(supabase, "viewer-1", {
    logIds: ["log-1"],
    listIds: ["list-1"],
  });
  assert.deepEqual(calls, [
    {
      fn: "viewer_state",
      args: {
        p_log_ids: ["log-1"],
        p_list_ids: ["list-1"],
        p_comment_ids: [],
      },
    },
  ]);
  assert.ok(viewer.likedLogs.has("log-1"));
  assert.ok(viewer.likedLists.has("list-1"));
  assert.ok(viewer.blocked.has("person-1"));
});
