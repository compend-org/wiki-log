// ABOUTME: Admins' moderation actions: closing reports, removing posts, and warning or suspending people.
// ABOUTME: Anyone can call a server action directly, so the database function makes the admin check.
"use server";

import { updateTag } from "next/cache";
import type { PostKind, ReportKind, ReportStatus } from "@/lib/adminReports";
import { POSTS_CACHE_TAG } from "@/lib/cacheTags";
import {
  commentImagePaths,
  hideCommentImageFiles,
  showCommentImageFiles,
} from "@/lib/commentImageFiles";
import type { CommentTable } from "@/lib/comments";
import { isUuid } from "@/lib/ids";
import {
  cleanNote,
  isReportReason,
  type ModerationInput,
  SUSPENSION_DAYS,
} from "@/lib/moderation";
import { createClient } from "@/lib/supabase/server";

const KINDS: PostKind[] = ["log", "list", "comment", "list_comment"];
const REPORT_KINDS: ReportKind[] = [...KINDS, "profile"];
const STATUSES: ReportStatus[] = ["open", "actioned", "dismissed"];
// Where each kind of comment is stored
const COMMENT_TABLE_OF: Partial<Record<PostKind, CommentTable>> = {
  comment: "comments",
  list_comment: "list_comments",
};

export async function setReportStatus(
  kind: ReportKind,
  postId: string,
  status: ReportStatus,
): Promise<{ error?: string }> {
  if (
    !REPORT_KINDS.includes(kind) ||
    !STATUSES.includes(status) ||
    !isUuid(postId)
  ) {
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

export async function setAccountReportStatus(
  userId: string,
  reportedBefore: string,
  status: ReportStatus,
): Promise<{ error?: string }> {
  if (
    !isUuid(userId) ||
    (status !== "actioned" && status !== "dismissed") ||
    Number.isNaN(Date.parse(reportedBefore))
  ) {
    return { error: "Invalid report." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_account_report_status", {
    p_user_id: userId,
    p_status: status,
    p_reported_before: reportedBefore,
  });
  if (error) return { error: "Couldn't update the reports." };
  return {};
}

// Hides a post from everyone but its author and closes its open reports
export async function removePost(
  kind: PostKind,
  postId: string,
  input: ModerationInput,
): Promise<{ error?: string }> {
  if (!KINDS.includes(kind) || !isUuid(postId))
    return { error: "Invalid post." };
  if (!isReportReason(input.reason)) return { error: "Choose a reason." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_remove_post", {
    p_kind: kind,
    p_id: postId,
    p_reason: input.reason,
    p_note: cleanNote(input.note),
  });
  if (error) return { error: error.message };
  // The feeds keep a copy of public posts for a few minutes
  updateTag(POSTS_CACHE_TAG);

  // Images are served by public URL, so hiding the comment isn't enough.
  // The database has checked this is an admin acting.
  const table = COMMENT_TABLE_OF[kind];
  if (table) {
    const images = await commentImagePaths(table, postId, false);
    if (images.error) return { error: `Removed, but ${images.error}` };
    const failed = await hideCommentImageFiles(images.paths);
    if (failed > 0) {
      return { error: `Removed, but ${failed} image(s) are still public.` };
    }
  }
  return {};
}

export async function restorePost(
  kind: PostKind,
  postId: string,
  input: ModerationInput,
): Promise<{ error?: string }> {
  if (!KINDS.includes(kind) || !isUuid(postId))
    return { error: "Invalid post." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_restore_post", {
    p_kind: kind,
    p_id: postId,
    p_note: cleanNote(input.note),
  });
  if (error) return { error: error.message };
  updateTag(POSTS_CACHE_TAG);

  // The database has checked this is an admin acting
  const table = COMMENT_TABLE_OF[kind];
  if (table) {
    const images = await commentImagePaths(table, postId, false);
    if (images.error) return { error: `Restored, but ${images.error}` };
    const failed = await showCommentImageFiles(images.paths);
    if (failed > 0) {
      return { error: `Restored, but ${failed} image(s) didn't come back.` };
    }
  }
  return {};
}

export async function warnUser(
  userId: string,
  input: ModerationInput,
): Promise<{ error?: string }> {
  if (!isUuid(userId)) return { error: "Invalid user." };
  if (!isReportReason(input.reason)) return { error: "Choose a reason." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_warn", {
    p_user_id: userId,
    p_reason: input.reason,
    p_note: cleanNote(input.note),
  });
  return error ? { error: error.message } : {};
}

export async function suspendUser(
  userId: string,
  input: ModerationInput,
): Promise<{ error?: string }> {
  if (!isUuid(userId)) return { error: "Invalid user." };
  if (!isReportReason(input.reason)) return { error: "Choose a reason." };
  if (!SUSPENSION_DAYS.some((d) => d === input.days)) {
    return { error: "Choose how long." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_suspend", {
    p_user_id: userId,
    p_days: input.days,
    p_reason: input.reason,
    p_note: cleanNote(input.note),
  });
  return error ? { error: error.message } : {};
}

export async function liftSuspension(
  userId: string,
  input: ModerationInput,
): Promise<{ error?: string }> {
  if (!isUuid(userId)) return { error: "Invalid user." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_lift_suspension", {
    p_user_id: userId,
    p_note: cleanNote(input.note),
  });
  return error ? { error: error.message } : {};
}

// Stops someone attaching images to comments, until lifted. Their images
// already posted stay up, and they aren't told.
export async function blockImages(
  userId: string,
  input: ModerationInput,
): Promise<{ error?: string }> {
  if (!isUuid(userId)) return { error: "Invalid user." };
  if (!isReportReason(input.reason)) return { error: "Choose a reason." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_block_images", {
    p_user_id: userId,
    p_reason: input.reason,
    p_note: cleanNote(input.note),
  });
  return error ? { error: error.message } : {};
}

export async function unblockImages(
  userId: string,
  input: ModerationInput,
): Promise<{ error?: string }> {
  if (!isUuid(userId)) return { error: "Invalid user." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_unblock_images", {
    p_user_id: userId,
    p_note: cleanNote(input.note),
  });
  return error ? { error: error.message } : {};
}
