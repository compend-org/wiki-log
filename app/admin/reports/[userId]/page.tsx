// ABOUTME: One reported account in full: its reported posts, who reported them, and its recent activity.
// ABOUTME: Admins only. The proxy serves everyone else a 404, and the data refuses them as well.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { unbanUser } from "@/app/actions";
import {
  blockImages,
  liftSuspension,
  removePost,
  restorePost,
  setReportStatus,
  unblockImages,
  warnUser,
} from "@/app/admin/reports/actions";
import AdminBadge from "@/components/AdminBadge";
import AdminPost from "@/components/AdminPost";
import BanButton from "@/components/buttons/BanButton";
import ModerationButton from "@/components/buttons/ModerationButton";
import ReportStatusButtons from "@/components/buttons/ReportStatusButtons";
import SuspendButton from "@/components/buttons/SuspendButton";
import RevealAvatar from "@/components/RevealAvatar";
import {
  type AdminPost as AdminPostData,
  combinedStatus,
  countLabel,
  getAccountModeration,
  getReportedAccount,
  type ModerationAction,
  type PostKind,
  type ReportedAccount,
} from "@/lib/adminReports";
import { timeAgo } from "@/lib/format";
import { isUuid } from "@/lib/ids";

export const metadata: Metadata = {
  title: "Reported account",
  robots: { index: false, follow: false },
};
export const instant = false;

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col rounded-lg border border-line p-3">
      <span className="text-2xl font-bold leading-none">{value}</span>
      <span className="mt-1 text-xs text-muted">{label}</span>
    </div>
  );
}

// Removes a post, or restores it once removed. A banned account's posts stay
// hidden until the ban is lifted, so they get neither.
function PostRemovalButton({
  kind,
  id,
  post,
  banned,
}: {
  kind: PostKind;
  id: string;
  post: AdminPostData;
  banned: boolean;
}) {
  if (!post.exists || banned) return null;
  return post.removed_at ? (
    <ModerationButton
      label="Restore"
      title="Restore this post?"
      description="Everyone will be able to see it again, and its author is told it was restored."
      run={restorePost.bind(null, kind, id)}
    />
  ) : (
    <ModerationButton
      label="Remove"
      title="Remove this post?"
      description="Only its author will still see it, marked as removed. Its open reports are closed as actioned, and its author is told why."
      askReason
      danger
      run={removePost.bind(null, kind, id)}
    />
  );
}

const ACTION_LABELS: Record<ModerationAction["kind"], string> = {
  warn: "Warned",
  remove_post: "Removed a post",
  restore_post: "Restored a post",
  suspend: "Suspended",
  lift_suspension: "Lifted the suspension",
  ban: "Banned",
  unban: "Lifted the ban",
  close_reports: "Closed reports",
  reopen_reports: "Reopened reports",
  block_images: "Blocked images",
  unblock_images: "Allowed images again",
};

function ActionEntry({
  action,
  now,
}: {
  action: ModerationAction;
  now: number;
}) {
  const details = [
    action.reason,
    action.report_status &&
      action.report_status !== "open" &&
      `as ${action.report_status}`,
    action.report_count > 0 && countLabel(action.report_count, "report"),
    action.suspended_until &&
      `until ${new Date(action.suspended_until).toLocaleDateString()}`,
  ].filter(Boolean);

  return (
    <li className="flex flex-col gap-0.5 py-2 text-sm">
      <p>
        <span className="font-medium">{ACTION_LABELS[action.kind]}</span>
        {details.length > 0 && (
          <span className="text-muted"> · {details.join(" · ")}</span>
        )}
      </p>
      <p className="text-muted">
        {action.admin ?? "A former admin"} · {timeAgo(action.at, now)}
      </p>
      {action.note && (
        <p className="whitespace-pre-wrap break-words italic text-muted">
          “{action.note}”
        </p>
      )}
    </li>
  );
}

function FlaggedPost({
  flagged,
  now,
  banned,
}: {
  flagged: ReportedAccount["flagged"][number];
  now: number;
  banned: boolean;
}) {
  const status = combinedStatus(flagged.reports);

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line p-4">
      <AdminPost kind={flagged.kind} post={flagged.post} now={now} />

      <ul className="flex flex-col gap-2 border-l-2 border-line pl-3 text-sm">
        {flagged.reports.map((report) => (
          <li key={report.id}>
            <span className="font-medium">{report.reason}</span>
            <span className="text-muted">
              {" from "}
              {report.reporter_id ? (
                <Link
                  href={`/admin/reports/${report.reporter_id}`}
                  prefetch={false}
                  className="hover:underline"
                >
                  {report.reporter}
                </Link>
              ) : (
                "the automatic image check"
              )}
              {` · ${timeAgo(report.at, now)}`}
              {report.status !== "open" && ` · ${report.status}`}
            </span>
            {report.details && (
              <p className="whitespace-pre-wrap break-words italic text-muted">
                “{report.details}”
              </p>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        {status !== "open" && (
          <span className="text-sm text-muted">Closed as {status}</span>
        )}
        <ReportStatusButtons
          setStatus={setReportStatus.bind(null, flagged.kind, flagged.id)}
          status={status}
        />
        {/* A profile can't be removed, only its account warned, suspended or banned */}
        {flagged.kind !== "profile" && (
          <PostRemovalButton
            kind={flagged.kind}
            id={flagged.id}
            post={flagged.post}
            banned={banned}
          />
        )}
      </div>
    </li>
  );
}

export default async function ReportedAccountPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await connection();
  const { userId } = await params;
  if (!isUuid(userId)) notFound();

  const [account, moderation] = await Promise.all([
    getReportedAccount(userId),
    getAccountModeration(userId),
  ]);
  const now = Date.now();
  const openReports = account.flagged
    .flatMap((flagged) => flagged.reports)
    .filter((report) => report.status === "open").length;
  const reporters = new Set(
    account.flagged.flatMap((flagged) =>
      flagged.reports.map((report) => report.reporter_id),
    ),
  ).size;
  const totalPosts =
    account.review_count + account.list_count + account.comment_count;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-4 sm:p-8">
      <header className="flex flex-col gap-3">
        <Link
          href="/admin/reports"
          prefetch={false}
          className="text-sm text-muted hover:underline"
        >
          ← Reports
        </Link>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="break-all text-3xl font-bold">{account.username}</h1>
          {account.is_admin && <AdminBadge />}
        </div>
        <p className="text-sm text-muted">
          Joined {timeAgo(account.joined_at, now)}
          {" · "}
          <Link
            href={`/u/${encodeURIComponent(account.username)}`}
            prefetch={false}
            className="hover:underline"
          >
            Public profile
          </Link>
        </p>
        {account.bio && (
          <p className="whitespace-pre-wrap break-words">{account.bio}</p>
        )}
        <RevealAvatar path={account.avatar_path} />
        {moderation.banned_at && (
          <p className="font-medium text-danger">
            Banned {timeAgo(moderation.banned_at, now)}
          </p>
        )}
        {moderation.suspended_until && (
          <p className="font-medium text-danger">
            Suspended until{" "}
            {new Date(moderation.suspended_until).toLocaleString()}
          </p>
        )}
        {moderation.images_blocked_at && (
          <p className="font-medium text-danger">
            Can't add images since{" "}
            {new Date(moderation.images_blocked_at).toLocaleString()}
          </p>
        )}
        {!account.is_admin &&
          (moderation.banned_at ? (
            <div className="flex flex-wrap gap-2">
              <ModerationButton
                label="Lift ban"
                title={`Lift the ban on ${account.username}?`}
                description="Their profile and the posts the ban hid come back, and they can sign in again. Likes, shares and follows the ban removed don't come back."
                run={unbanUser.bind(null, account.id)}
              />
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <ModerationButton
                label="Warn"
                title={`Warn ${account.username}?`}
                description="They get a notification naming the reason, and the open reports about them are closed as actioned. Nothing else changes."
                askReason
                run={warnUser.bind(null, account.id)}
              />
              {moderation.suspended_until ? (
                <ModerationButton
                  label="Lift suspension"
                  title={`Lift ${account.username}'s suspension?`}
                  description="They can post, comment, like, share and follow again straight away, and are told so."
                  run={liftSuspension.bind(null, account.id)}
                />
              ) : (
                <SuspendButton
                  userId={account.id}
                  username={account.username}
                />
              )}
              {moderation.images_blocked_at ? (
                <ModerationButton
                  label="Allow images"
                  title={`Let ${account.username} add images again?`}
                  description="They can attach images and GIFs to comments again straight away. They aren't told."
                  run={unblockImages.bind(null, account.id)}
                />
              ) : (
                <ModerationButton
                  label="Block images"
                  title={`Stop ${account.username} adding images?`}
                  description="They can't attach images or GIFs to comments until you allow it again. Images they already posted stay up. They aren't told, but the comment form stops offering images."
                  askReason
                  run={blockImages.bind(null, account.id)}
                />
              )}
              <BanButton
                userId={account.id}
                username={account.username}
                className="rounded-lg border border-danger px-2.5 py-1 text-sm text-danger"
              />
            </div>
          ))}
      </header>

      <section aria-label="Summary" className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="people reported them" value={reporters} />
          <Stat label="open reports" value={openReports} />
          <Stat label="posts reported" value={account.flagged.length} />
          <Stat label="people blocked them" value={account.blocked_by_count} />
          <Stat label="posts in total" value={totalPosts} />
          <Stat label="posts in the last day" value={account.posts_last_day} />
          <Stat
            label="posts in the last week"
            value={account.posts_last_week}
          />
          <Stat label="reports they filed" value={account.filed.total} />
        </div>
        <p className="text-sm text-muted">
          {countLabel(account.review_count, "review")} ·{" "}
          {countLabel(account.list_count, "list")} ·{" "}
          {countLabel(account.comment_count, "comment")}
          {account.filed.total > 0 &&
            ` · of the reports they filed, ${account.filed.actioned} actioned and ${account.filed.dismissed} dismissed`}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Reported posts</h2>
        {account.flagged.length === 0 ? (
          <p className="text-muted">Nobody has reported this account.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {account.flagged.map((flagged) => (
              <FlaggedPost
                key={flagged.id}
                flagged={flagged}
                now={now}
                banned={moderation.banned_at !== null}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Recent activity</h2>
        {account.activity.length === 0 ? (
          <p className="text-muted">Nothing posted.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {account.activity.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-1 py-3">
                {entry.flagged && (
                  <span className="text-sm font-medium text-danger">
                    Reported
                  </span>
                )}
                <AdminPost
                  kind={entry.kind}
                  post={entry.post}
                  now={now}
                  clamp
                />
                <div className="flex">
                  <PostRemovalButton
                    kind={entry.kind}
                    id={entry.id}
                    post={entry.post}
                    banned={moderation.banned_at !== null}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        {totalPosts > account.activity.length && (
          <p className="text-center text-sm text-muted">
            Showing the latest {account.activity.length} of {totalPosts} posts
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Moderation history</h2>
        {moderation.actions.length === 0 ? (
          <p className="text-muted">No moderation actions yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {moderation.actions.map((action) => (
              <ActionEntry key={action.id} action={action} now={now} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
