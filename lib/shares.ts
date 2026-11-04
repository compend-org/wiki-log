import type { SupabaseClient } from "@supabase/supabase-js";

// Which of these reviews or lists has the viewer shared? Returns their ids.
export async function getSharedSet(
  supabase: SupabaseClient,
  viewerId: string | undefined,
  kind: "log" | "list",
  ids: string[],
): Promise<Set<string>> {
  if (!viewerId || ids.length === 0) return new Set();

  const column = kind === "log" ? "log_id" : "list_id";
  const { data } = await supabase
    .from("shares")
    .select(column)
    .eq("user_id", viewerId)
    .in(column, ids);

  return new Set(
    ((data ?? []) as unknown as Record<string, string>[]).map((r) => r[column]),
  );
}
