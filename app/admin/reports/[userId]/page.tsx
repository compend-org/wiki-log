// ABOUTME: One reported account in full: its reported posts, who reported them, and its recent activity.
// ABOUTME: Admins only. The proxy serves everyone else a 404, and the data refuses them as well.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { setReportStatus } from "@/app/admin/reports/actions";
import AdminBadge from "@/components/AdminBadge";
import AdminPost from "@/components/AdminPost";
import BanButton from "@/components/BanButton";
import ReportStatusButtons from "@/components/ReportStatusButtons";
import RevealAvatar from "@/components/RevealAvatar";
import {
  combinedStatus,
  countLabel,
  getReportedAccount,
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

function FlaggedPost({
  flagged,
  now,
}: {
  flagged: ReportedAccount["flagged"][number];
  now: number;
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
              <Link
                href={`/admin/reports/${report.reporter_id}`}
                prefetch={false}
                className="hover:underline"
              >
                {report.reporter}
              </Link>
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

  const account = await getReportedAccount(userId);
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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
        {!account.is_admin && (
          <BanButton
            userId={account.id}
            username={account.username}
            redirectTo="/admin/reports"
            className="self-start rounded-lg border border-danger px-2.5 py-1 text-sm text-danger"
          />
        )}
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
              <FlaggedPost key={flagged.id} flagged={flagged} now={now} />
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
    </main>
  );
}
