// ABOUTME: Loads the admin reports pages' data from database functions that refuse anyone but admins.
// ABOUTME: A refusal becomes a 404, so these pages look missing to non-admins even if the proxy doesn't run.
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type PostKind = "log" | "list" | "comment" | "list_comment";
// What a report can be about: a post, or the account itself
export type ReportKind = PostKind | "profile";
export type ReportStatus = "open" | "actioned" | "dismissed";

export type AdminPost = {
  exists: boolean;
  removed_at?: string | null;
  at?: string;
  body?: string | null;
  // Comments only: how many images or GIFs it has
  image_count?: number;
  rating?: number | null;
  item_id?: string;
  title?: string | null;
  list_id?: string;
  item_count?: number;
  item_titles?: string[];
  href_log?: { username: string; id: string };
  href_profile?: string;
};

export type QueueAccount = {
  user_id: string;
  username: string;
  joined_at: string;
  report_count: number;
  reporter_count: number;
  flagged_post_count: number;
  first_report_at: string;
  last_report_at: string;
  banned_at: string | null;
  is_admin: boolean;
  reasons: Record<string, number>;
  review_count: number;
  list_count: number;
  comment_count: number;
  last_active_at: string | null;
  top_posts: {
    kind: ReportKind;
    id: string;
    report_count: number;
    note: string | null;
    post: AdminPost;
  }[];
};

export type ReportQueue = {
  open_reports: number;
  reports_last_day: number;
  account_count: number;
  accounts: QueueAccount[];
};

export type AccountReport = {
  id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  at: string;
  // Null for reports filed by the automatic image check
  reporter_id: string | null;
  reporter: string | null;
};

export type ReportedAccount = {
  id: string;
  username: string;
  bio: string | null;
  avatar_path: string | null;
  joined_at: string;
  is_admin: boolean;
  review_count: number;
  list_count: number;
  comment_count: number;
  posts_last_day: number;
  posts_last_week: number;
  blocked_by_count: number;
  filed: { total: number; dismissed: number; actioned: number };
  flagged: {
    kind: ReportKind;
    id: string;
    post: AdminPost;
    reports: AccountReport[];
  }[];
  activity: {
    kind: PostKind;
    id: string;
    flagged: boolean;
    post: AdminPost;
  }[];
};

// Postgres's "insufficient privilege", raised for anyone who isn't an admin
const NOT_ALLOWED = "42501";

export async function getReportQueue(
  includeHandled: boolean,
): Promise<ReportQueue> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_report_queue", {
    p_include_handled: includeHandled,
  });
  if (error?.code === NOT_ALLOWED) notFound();
  if (error) throw new Error(`Couldn't load reports: ${error.message}`);
  return data as ReportQueue;
}

export async function getReportedAccount(
  userId: string,
): Promise<ReportedAccount> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_report_account", {
    p_user_id: userId,
  });
  if (error?.code === NOT_ALLOWED) notFound();
  if (error) throw new Error(`Couldn't load account: ${error.message}`);
  if (!data) notFound();
  return data as ReportedAccount;
}

export type ModerationAction = {
  id: string;
  kind:
    | "warn"
    | "remove_post"
    | "restore_post"
    | "suspend"
    | "lift_suspension"
    | "ban"
    | "unban"
    | "close_reports"
    | "reopen_reports"
    | "block_images"
    | "unblock_images";
  at: string;
  admin: string | null;
  reason: string | null;
  note: string | null;
  target_type: ReportKind | null;
  target_id: string | null;
  report_status: ReportStatus | null;
  report_count: number;
  suspended_until: string | null;
};

export type AccountModeration = {
  banned_at: string | null;
  suspended_until: string | null;
  // Since when a moderator has stopped them attaching images
  images_blocked_at: string | null;
  actions: ModerationAction[];
};

export async function getAccountModeration(
  userId: string,
): Promise<AccountModeration> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_account_moderation", {
    p_user_id: userId,
  });
  if (error?.code === NOT_ALLOWED) notFound();
  if (error) throw new Error(`Couldn't load moderation: ${error.message}`);
  return data as AccountModeration;
}

export type BannedAccount = {
  user_id: string;
  username: string;
  banned_at: string;
  reason: string | null;
};

export async function getBannedAccounts(): Promise<BannedAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_banned_accounts");
  if (error?.code === NOT_ALLOWED) notFound();
  if (error) throw new Error(`Couldn't load banned accounts: ${error.message}`);
  return data as BannedAccount[];
}

// The public page a post or profile appears on, when it still exists
export function postHref(post: AdminPost): string | null {
  if (post.href_profile) return `/u/${encodeURIComponent(post.href_profile)}`;
  if (post.href_log) {
    const { username, id } = post.href_log;
    return `/u/${encodeURIComponent(username)}/${id}`;
  }
  if (post.list_id) return `/list/${post.list_id}`;
  return null;
}

// The status a post's reports add up to: open until none of them are
export function combinedStatus(
  reports: Pick<AccountReport, "status">[],
): ReportStatus {
  if (reports.some((r) => r.status === "open")) return "open";
  return reports.some((r) => r.status === "actioned")
    ? "actioned"
    : "dismissed";
}

// "1 review", "2 reviews"
export function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

// "9 min", "5 h" or "3 days": how long separates two moments
export function gapLabel(from: string, to: string): string {
  const minutes = Math.max(
    0,
    Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000),
  );
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} days`;
}

// Reported within a day of signing up, the mark of a throwaway account
export function reportedSoonAfterJoining(
  joinedAt: string,
  firstReportAt: string,
): boolean {
  const gap = new Date(firstReportAt).getTime() - new Date(joinedAt).getTime();
  return gap >= 0 && gap < 24 * 60 * 60 * 1000;
}
