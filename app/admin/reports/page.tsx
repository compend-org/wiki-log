// ABOUTME: The admin reports queue: reported accounts ranked by how many people reported them.
// ABOUTME: Admins only. The proxy serves everyone else a 404, and the data refuses them as well.
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { setAccountReportStatus } from "@/app/admin/reports/actions";
import AdminBadge from "@/components/AdminBadge";
import AdminPost from "@/components/AdminPost";
import BanButton from "@/components/buttons/BanButton";
import ReportStatusButtons from "@/components/buttons/ReportStatusButtons";
import SuspendButton from "@/components/buttons/SuspendButton";
import {
  countLabel,
  gapLabel,
  getBannedAccounts,
  getReportQueue,
  type QueueAccount,
  reportedSoonAfterJoining,
} from "@/lib/adminReports";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = {
  title: "Reports",
  robots: { index: false, follow: false },
};
export const instant = false;

function AccountRow({
  account,
  now,
  showingOpen,
}: {
  account: QueueAccount;
  now: number;
  // In the Open view every report on the card is open, so they can be closed
  showingOpen: boolean;
}) {
  const reasons = Object.entries(account.reasons).sort((a, b) => b[1] - a[1]);

  return (
    <li className="flex gap-4 rounded-lg border border-line p-4">
      <div className="flex w-16 shrink-0 flex-col items-center text-center">
        <span className="text-3xl font-bold leading-none">
          {account.reporter_count}
        </span>
        <span className="mt-1 text-xs text-muted">
          {account.reporter_count === 1 ? "reporter" : "reporters"}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/admin/reports/${account.user_id}`}
              prefetch={false}
              className="break-all font-semibold hover:underline"
            >
              {account.username}
            </Link>
            {account.is_admin && <AdminBadge />}
            {reportedSoonAfterJoining(
              account.joined_at,
              account.first_report_at,
            ) && (
              <span className="text-sm text-danger">
                Reported {gapLabel(account.joined_at, account.first_report_at)}{" "}
                after joining
              </span>
            )}
          </p>
          <p className="text-sm">
            {countLabel(account.report_count, "report")} on{" "}
            {countLabel(account.flagged_post_count, "post")}
            {reasons.map(([reason, count]) => (
              <span key={reason} className="text-muted">
                {" · "}
                {reason} {count}
              </span>
            ))}
          </p>
          <p className="text-sm text-muted">
            {countLabel(account.review_count, "review")} ·{" "}
            {countLabel(account.list_count, "list")} ·{" "}
            {countLabel(account.comment_count, "comment")} · joined{" "}
            {timeAgo(account.joined_at, now)}
            {account.last_active_at &&
              ` · active ${timeAgo(account.last_active_at, now)}`}
          </p>
        </div>

        <ul className="flex flex-col gap-3 border-l-2 border-line pl-3">
          {account.top_posts.map((top) => (
            <li key={top.id} className="flex flex-col gap-1">
              <AdminPost kind={top.kind} post={top.post} now={now} clamp />
              <p className="text-sm text-muted">
                {top.report_count > 1 && `${top.report_count} reports`}
                {top.report_count > 1 && top.note && " · "}
                {top.note && (
                  <span className="italic">“{top.note.slice(0, 160)}”</span>
                )}
              </p>
            </li>
          ))}
        </ul>

        {(showingOpen || !account.is_admin) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {showingOpen && (
              <>
                <span className="text-sm text-muted">All open reports:</span>
                <ReportStatusButtons
                  setStatus={setAccountReportStatus.bind(
                    null,
                    account.user_id,
                    account.last_report_at,
                  )}
                  status="open"
                />
              </>
            )}
            {account.banned_at ? (
              <span className="text-sm font-medium text-danger">Banned</span>
            ) : (
              !account.is_admin && (
                <>
                  <SuspendButton
                    userId={account.user_id}
                    username={account.username}
                  />
                  <BanButton
                    userId={account.user_id}
                    username={account.username}
                    className="rounded-lg border border-danger px-2.5 py-1 text-sm text-danger"
                  />
                </>
              )
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await connection();
  const { view } = await searchParams;
  const showing = view === "all" || view === "banned" ? view : "open";
  const [queue, banned] = await Promise.all([
    getReportQueue(showing === "all"),
    showing === "banned" ? getBannedAccounts() : [],
  ]);
  const now = Date.now();

  const tab = "rounded-lg border border-line px-2.5 py-1 text-sm";
  const activeTab = `${tab} bg-surface font-semibold`;
  const tabs = [
    { view: "open", label: "Open", href: "/admin/reports" },
    { view: "all", label: "All", href: "/admin/reports?view=all" },
    { view: "banned", label: "Banned", href: "/admin/reports?view=banned" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-sm text-muted">
          {queue.open_reports} open ·{" "}
          {countLabel(queue.account_count, "account")} ·{" "}
          {queue.reports_last_day} new in the last day
        </p>
      </header>

      <nav aria-label="Filter reports" className="flex gap-2">
        {tabs.map((t) => (
          <Link
            key={t.view}
            href={t.href}
            prefetch={false}
            aria-current={showing === t.view ? "page" : undefined}
            className={showing === t.view ? activeTab : tab}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {showing === "banned" ? (
        banned.length === 0 ? (
          <p className="py-12 text-center text-muted">Nobody is banned.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {banned.map((account) => (
              <li key={account.user_id} className="flex flex-col gap-0.5 py-3">
                <Link
                  href={`/admin/reports/${account.user_id}`}
                  prefetch={false}
                  className="break-all font-semibold hover:underline"
                >
                  {account.username}
                </Link>
                <span className="text-sm text-muted">
                  Banned {timeAgo(account.banned_at, now)}
                  {account.reason && ` · ${account.reason}`}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : queue.accounts.length === 0 ? (
        <p className="py-12 text-center text-muted">Nothing to look at.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {queue.accounts.map((account) => (
            <AccountRow
              key={account.user_id}
              account={account}
              now={now}
              showingOpen={showing === "open"}
            />
          ))}
        </ol>
      )}

      {showing !== "banned" && queue.account_count > queue.accounts.length && (
        <p className="text-center text-sm text-muted">
          Showing the top {queue.accounts.length} of {queue.account_count}{" "}
          accounts
        </p>
      )}
    </main>
  );
}
