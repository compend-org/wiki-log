"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { deleteComment } from "@/app/actions";
import CommentLikeButton from "@/components/buttons/CommentLikeButton";
import ReportButton from "@/components/buttons/ReportButton";
import CommentImageButton from "@/components/CommentImageButton";
import CommentImagePreview from "@/components/CommentImagePreview";
import CommentImages from "@/components/CommentImages";
import ReviewText from "@/components/ReviewText";
import { track } from "@/lib/analytics";
import { mentionToken } from "@/lib/format";
import type { ImageAttachStatus } from "@/lib/commentImages";
import {
  removeOwnCommentImages,
  uploadCommentImages,
} from "@/lib/commentImageUpload";
import { createClient } from "@/lib/supabase/client";
import { useLoginHref } from "@/lib/useLoginHref";
import AdminBadge from "./AdminBadge";
import ConfirmDialog from "./ConfirmDialog";
import ReviewTextarea from "./ReviewTextArea";

export type CommentItem = {
  id: string;
  parentId: string | null;
  body: string;
  // Paths of its images and GIFs in the comment-images bucket
  images: string[];
  date: string;
  authorId: string;
  authorName: string;
  likeCount: number;
  liked: boolean;
  authorIsAdmin?: boolean;
  // Removed by the moderators. Only its author is ever sent one of these.
  removed?: boolean;
};

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
  const loginHref = useLoginHref();
  const [topText, setTopText] = useState<string>("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>("");
  const [topImage, setTopImage] = useState<File | null>(null);
  const [replyImage, setReplyImage] = useState<File | null>(null);
  const [imageStatus, setImageStatus] = useState<ImageAttachStatus | null>(
    null,
  );
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [deleting, setDeleting] = useState<CommentItem | null>(null);
  const router = useRouter();

  // New and blocked accounts can't attach images; the database enforces the
  // same rule
  useEffect(() => {
    if (!viewerId) return;
    createClient()
      .rpc("my_image_attach_status")
      .then(({ data }) => setImageStatus(data as ImageAttachStatus));
  }, [viewerId]);

  const topLevel = comments.filter((c) => c.parentId === null);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  async function post(
    body: string,
    image: File | null,
    parentId: string | null,
  ): Promise<boolean> {
    if (!viewerId) return false;
    const trimmed = body.trim();
    if (trimmed.length > 1000) {
      setError("Comments are up to 1000 characters.");
      return false;
    }
    if (trimmed.length === 0 && !image) {
      setError("Write something or add an image.");
      return false;
    }

    setBusy(true);
    setError("");
    const supabase = createClient();
    const uploaded = await uploadCommentImages(
      supabase,
      viewerId,
      image ? [image] : [],
    );
    if (uploaded.error !== undefined) {
      setBusy(false);
      setError(uploaded.error);
      return false;
    }
    const { error } = await supabase.from(table).insert({
      ...scope,
      user_id: viewerId,
      parent_id: parentId,
      body: trimmed,
      images: uploaded.paths,
    });
    if (error) await removeOwnCommentImages(supabase, uploaded.paths);
    setBusy(false);

    if (error) {
      setError(error.message);
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
    if (await post(topText, topImage, null)) {
      setTopText("");
      setTopImage(null);
    }
  }

  async function submitReply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (replyTo && (await post(replyText, replyImage, replyTo))) {
      setReplyTo(null);
      setReplyText("");
      setReplyImage(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError("");
    const { error } = await deleteComment(table, deleting.id);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    track("comment_deleted", { target: table === "comments" ? "log" : "list" });
    setDeleting(null);
    router.refresh();
  }

  function renderComment(c: CommentItem, rootId: string) {
    const canDelete = viewerId === c.authorId || viewerId === ownerId;
    return (
      <div key={c.id} className="flex flex-col gap-1">
        {deleting && (
          <ConfirmDialog
            title="Delete this comment?"
            confirmLabel="Delete"
            busyLabel="Deleting…"
            busy={busy}
            error={error}
            onConfirm={confirmDelete}
            onCancel={() => setDeleting(null)}
          >
            {repliesOf(deleting.id).length > 0 && (
              <p>Its replies are deleted with it.</p>
            )}
          </ConfirmDialog>
        )}
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/u/${encodeURIComponent(c.authorName)}`}
            className="font-semibold hover:underline"
          >
            {c.authorName}
          </Link>
          {c.authorIsAdmin && <AdminBadge />}
          <span className="text-xs text-muted">{c.date}</span>
          {c.removed && (
            <span className="text-xs font-medium text-danger">
              Removed by the moderators · only you can see it
            </span>
          )}
        </div>
        {c.body && (
          <p className="whitespace-pre-wrap text-sm">
            <ReviewText text={c.body} />
          </p>
        )}
        {c.removed ? (
          c.images.length > 0 && (
            <p className="text-xs text-muted">
              {c.images.length === 1 ? "Image" : "Images"} hidden by the
              moderators
            </p>
          )
        ) : (
          <CommentImages paths={c.images} />
        )}
        <div className="flex gap-3 text-xs text-muted">
          <CommentLikeButton
            viewerId={viewerId}
            commentTable={table}
            commentId={c.id}
            authorId={c.authorId}
            initialCount={c.likeCount}
            initiallyLiked={c.liked}
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
                setReplyText(
                  c.parentId
                    ? `${mentionToken(c.authorId, c.authorName)} `
                    : "",
                );
                setReplyImage(null);
                setError("");
              }}
              className="hover:underline"
            >
              Reply
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
              className="underline"
            >
              Delete
            </button>
          )}
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
          ? "No comments yet"
          : `${total.toLocaleString("en-US")} ${total === 1 ? "comment" : "comments"}`}
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
          Show earlier comments
        </Link>
      )}

      {topLevel.map((c) => {
        const replies = repliesOf(c.id);
        return (
          <div key={c.id} className="card flex flex-col gap-3 p-3">
            {renderComment(c, c.id)}

            {replies.length > 0 && (
              <div className="ml-3 flex flex-col gap-3 border-l border-line pl-3">
                {replies.map((r) => renderComment(r, c.id))}
              </div>
            )}

            {replyTo === c.id && (
              <form onSubmit={submitReply} className="ml-3 flex flex-col gap-2">
                <ReviewTextarea
                  value={replyText}
                  onChange={setReplyText}
                  rows={2}
                  maxLength={1000}
                  autoFocus
                  placeholder="Write a reply"
                  className={inputClass}
                  accessory={
                    <CommentImageButton
                      status={imageStatus}
                      onPick={setReplyImage}
                      onError={setError}
                      disabled={busy}
                    />
                  }
                />
                <CommentImagePreview
                  file={replyImage}
                  onRemove={() => setReplyImage(null)}
                  disabled={busy}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-lg bg-accent px-3 py-1.5 text-sm text-background disabled:opacity-40"
                  >
                    {busy ? "Posting…" : "Reply"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo(null);
                      setReplyText("");
                      setReplyImage(null);
                      setError("");
                    }}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        );
      })}

      {viewerId ? (
        <form onSubmit={submitTop} className="flex flex-col gap-2">
          <ReviewTextarea
            value={topText}
            onChange={setTopText}
            rows={3}
            maxLength={1000}
            placeholder="Add a comment"
            className={inputClass}
            accessory={
              <CommentImageButton
                status={imageStatus}
                onPick={setTopImage}
                onError={setError}
                disabled={busy}
              />
            }
          />
          <CommentImagePreview
            file={topImage}
            onRemove={() => setTopImage(null)}
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || (topText.trim().length === 0 && !topImage)}
            className="self-start rounded-lg bg-accent px-4 py-2 text-background disabled:opacity-40"
          >
            {busy ? "Posting…" : "Comment"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-muted">
          <Link href={loginHref} className="underline">
            Sign in
          </Link>{" "}
          to comment.
        </p>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
