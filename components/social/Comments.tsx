"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import ReviewText from "@/components/logs/ReviewText";
import ReviewTextarea from "@/components/logs/ReviewTextArea";
import AdminBadge from "@/components/moderation/AdminBadge";
import ReportButton from "@/components/moderation/ReportButton";
import Avatar from "@/components/people/Avatar";
import CommentLikeButton from "@/components/social/CommentLikeButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { track } from "@/lib/analytics/analytics";
import {
  SAVE_FAILED,
  userFacingErrorMessage,
} from "@/lib/errors/userFacingErrorMessage";
import { mentionToken } from "@/lib/format";
import { submitOnModEnter } from "@/lib/hooks/submitShortcut";
import { useLoginHref } from "@/lib/hooks/useLoginHref";
import { createClient } from "@/lib/supabase/client";

export type CommentItem = {
  id: string;
  parentId: string | null;
  body: string;
  date: string;
  authorId: string;
  authorName: string;
  authorAvatarPath: string | null;
  likeCount: number;
  liked: boolean;
  authorIsAdmin?: boolean;
  // Removed by the moderators. Only its author is ever sent one of these.
  removed?: boolean;
  edited?: boolean;
};

// Profile picture widths, in pixels. Replies get smaller ones than the
// comments they answer.
const AVATAR_SIZE = { comment: 32, reply: 24 };

export default function Comments({
  comments,
  viewerId,
  table,
  scope,
  ownerId,
  total = comments.length,
  earlierHref = null,
}: {
  comments: CommentItem[];
  viewerId: string | null;
  // "comments" for reviews, "list_comments" for lists
  table: "comments" | "list_comments";
  // The columns that tie a comment to what it's on
  scope: Record<string, string>;
  // The owner of the review or list can delete any comment on it
  ownerId: string;
  // How many comments there are in all, when only some of them were loaded
  total?: number;
  // Where to go to load older threads too, when there are any
  earlierHref?: string | null;
}) {
  const t = useTranslations();
  const loginHref = useLoginHref();
  const [topText, setTopText] = useState<string>("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  // The comment Reply was pressed on, which the reply answers. The reply
  // itself goes under the thread's first comment (replyTo).
  const [answering, setAnswering] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [deleting, setDeleting] = useState<CommentItem | null>(null);
  const [editing, setEditing] = useState<CommentItem | null>(null);
  const [editText, setEditText] = useState<string>("");
  const router = useRouter();

  const topLevel = comments.filter((c) => c.parentId === null);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  async function post(
    body: string,
    parentId: string | null,
    replyToId: string | null = null,
  ): Promise<boolean> {
    if (!viewerId) return false;
    const trimmed = body.trim();
    if (trimmed.length < 1 || trimmed.length > 1000) {
      setError(t("errors.commentLength"));
      return false;
    }

    setBusy(true);
    setError("");
    const { error } = await createClient()
      .from(table)
      .insert({
        ...scope,
        user_id: viewerId,
        parent_id: parentId,
        reply_to_id: replyToId,
        body: trimmed,
      });
    setBusy(false);

    if (error) {
      setError(userFacingErrorMessage(error, SAVE_FAILED));
      return false;
    }
    track("comment_posted", {
      target: table === "comments" ? "log" : "list",
      is_reply: parentId !== null,
      length: trimmed.length,
    });
    router.refresh();
    return true;
  }

  async function submitTop(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (await post(topText, null)) setTopText("");
  }

  async function submitReply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (replyTo && (await post(replyText, replyTo, answering))) {
      setReplyTo(null);
      setReplyText("");
    }
  }

  async function submitEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!viewerId || !editing) return;
    const trimmed = editText.trim();
    if (trimmed.length < 1 || trimmed.length > 1000) {
      setError(t("errors.commentLength"));
      return;
    }
    if (trimmed === editing.body) {
      setEditing(null);
      return;
    }

    setBusy(true);
    setError("");
    const { data, error } = await createClient()
      .from(table)
      .update({ body: trimmed })
      .eq("id", editing.id)
      .select("id");
    setBusy(false);

    // Nothing changed with no error: it isn't theirs to edit, or was removed
    if (error || !data || data.length === 0) {
      setError(
        error ? userFacingErrorMessage(error, SAVE_FAILED) : SAVE_FAILED,
      );
      return;
    }
    track("comment_edited", {
      target: table === "comments" ? "log" : "list",
      length: trimmed.length,
    });
    setEditing(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError("");
    const { error } = await createClient()
      .from(table)
      .delete()
      .eq("id", deleting.id);
    setBusy(false);
    if (error) {
      setError(userFacingErrorMessage(error, SAVE_FAILED));
      return;
    }
    track("comment_deleted", { target: table === "comments" ? "log" : "list" });
    setDeleting(null);
    router.refresh();
  }

  function renderComment(c: CommentItem, rootId: string) {
    const canDelete = viewerId === c.authorId || viewerId === ownerId;
    const profileHref = `/u/${encodeURIComponent(c.authorName)}`;
    return (
      <div key={c.id} className="flex gap-2">
        {deleting && (
          <ConfirmDialog
            title={t("social.comments.deleteTitle")}
            confirmLabel={t("common.delete")}
            busyLabel={t("common.deleting")}
            busy={busy}
            error={error}
            onConfirm={confirmDelete}
            onCancel={() => setDeleting(null)}
          >
            {repliesOf(deleting.id).length > 0 && (
              <p>{t("social.comments.repliesDeleted")}</p>
            )}
          </ConfirmDialog>
        )}
        {/* The name beside it is the same link, so this one is skipped by
            keyboards and screen readers */}
        <Link href={profileHref} aria-hidden tabIndex={-1} className="shrink-0">
          <Avatar
            path={c.authorAvatarPath}
            size={c.parentId ? AVATAR_SIZE.reply : AVATAR_SIZE.comment}
          />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2 text-sm">
            <Link
              href={profileHref}
              className="min-w-0 truncate font-semibold hover:underline"
            >
              {c.authorName}
            </Link>
            {c.authorIsAdmin && <AdminBadge />}
            <span className="text-xs text-muted">
              {c.date}
              {c.edited && " · edited"}
            </span>
            {c.removed && (
              <span className="text-xs font-medium text-danger">
                {t("social.comments.removedByModerators")}
              </span>
            )}
          </div>
          {editing?.id === c.id ? (
            <form
              onSubmit={submitEdit}
              onKeyDown={submitOnModEnter}
              className="flex flex-col gap-2"
            >
              <ReviewTextarea
                value={editText}
                onChange={setEditText}
                rows={2}
                maxLength={1000}
                autoFocus
                className={inputClass}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  data-submit
                  disabled={busy || editText.trim().length === 0}
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm text-background disabled:opacity-40"
                >
                  {busy ? t("common.saving") : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setError("");
                  }}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          ) : (
            <div className="break-words text-sm">
              <ReviewText text={c.body} />
            </div>
          )}
          <div className="flex gap-3 text-xs text-muted">
            <CommentLikeButton
              viewerId={viewerId}
              commentTable={table}
              commentId={c.id}
              authorId={c.authorId}
              likeCount={c.likeCount}
              liked={c.liked}
            />
            <ReportButton
              viewerId={viewerId}
              ownerId={c.authorId}
              kind={table === "comments" ? "comment" : "list_comment"}
              targetId={c.id}
              className="hover:underline"
            />
            {viewerId && (
              <button
                type="button"
                onClick={() => {
                  setReplyTo(rootId);
                  setAnswering(c.id);
                  setReplyText(
                    c.parentId
                      ? `${mentionToken(c.authorId, c.authorName)} `
                      : "",
                  );
                  setError("");
                }}
                className="hover:underline"
              >
                {t("social.comments.reply")}
              </button>
            )}
            {viewerId === c.authorId && !c.removed && editing?.id !== c.id && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setEditing(c);
                  setEditText(c.body);
                }}
                className="hover:underline"
              >
                {t("common.edit")}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setDeleting(c);
                }}
                disabled={busy}
                className="hover:underline"
              >
                {t("common.delete")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground";

  return (
    <section id="comments" className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">
        {total === 0
          ? t("social.comments.none")
          : t("counts.comments", { count: total })}
      </h2>

      {/* Older threads come in above the ones shown, below this link, so it
          stays put and what was loaded shows up right under it */}
      {earlierHref && (
        <Link
          href={earlierHref}
          replace
          scroll={false}
          className="self-start text-sm underline"
        >
          {t("social.comments.showEarlier")}
        </Link>
      )}

      {topLevel.map((c) => {
        const replies = repliesOf(c.id);
        return (
          <div key={c.id} className="card flex flex-col gap-3 p-3">
            {renderComment(c, c.id)}

            {replies.length > 0 && (
              <div className="ml-4 flex flex-col gap-3 border-l border-line pl-5">
                {replies.map((r) => renderComment(r, c.id))}
              </div>
            )}

            {replyTo === c.id && (
              <form
                onSubmit={submitReply}
                onKeyDown={submitOnModEnter}
                className="ml-10 flex flex-col gap-2"
              >
                <ReviewTextarea
                  value={replyText}
                  onChange={setReplyText}
                  rows={2}
                  maxLength={1000}
                  autoFocus
                  placeholder={t("social.comments.writeReply")}
                  className={inputClass}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    data-submit
                    className="rounded-lg bg-accent px-3 py-1.5 text-sm text-background disabled:opacity-40"
                  >
                    {busy
                      ? t("social.comments.posting")
                      : t("social.comments.reply")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo(null);
                      setReplyText("");
                      setError("");
                    }}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </form>
            )}
          </div>
        );
      })}

      {viewerId ? (
        <form
          onSubmit={submitTop}
          onKeyDown={submitOnModEnter}
          className="flex flex-col gap-2"
        >
          <ReviewTextarea
            value={topText}
            onChange={setTopText}
            rows={3}
            maxLength={1000}
            placeholder={t("social.comments.addComment")}
            className={inputClass}
          />
          <button
            type="submit"
            data-submit
            disabled={busy || topText.trim().length === 0}
            className="self-start rounded-lg bg-accent px-4 py-2 text-background disabled:opacity-40"
          >
            {busy ? t("social.comments.posting") : t("counts.commentZero")}
          </button>
        </form>
      ) : (
        <p className="text-sm text-muted">
          {t.rich("social.comments.signInToComment", {
            signin: (c) => (
              <Link href={loginHref} className="underline">
                {c}
              </Link>
            ),
          })}
        </p>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
