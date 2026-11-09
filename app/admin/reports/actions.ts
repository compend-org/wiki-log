// ABOUTME: Lets admins mark the reports on a post as dismissed, actioned, or open again.
// ABOUTME: Anyone can call a server action directly, so the database function makes the admin check.
"use server";

import type { PostKind, ReportStatus } from "@/lib/adminReports";
import { isUuid } from "@/lib/ids";
import { createClient } from "@/lib/supabase/server";

const KINDS: PostKind[] = ["log", "list", "comment", "list_comment"];
const STATUSES: ReportStatus[] = ["open", "actioned", "dismissed"];

export async function setReportStatus(
  kind: PostKind,
  postId: string,
  status: ReportStatus,
): Promise<{ error?: string }> {
  if (!KINDS.includes(kind) || !STATUSES.includes(status) || !isUuid(postId)) {
    return { error: "Invalid report." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_report_status", {
    p_target_type: kind,
    p_target_id: postId,
    p_status: status,
  });
  if (error) return { error: "Couldn't update the report." };
  return {};
}
