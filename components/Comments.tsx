"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import CommentLikeButton from "@/components/CommentLikeButton";
import ReviewText from "@/components/ReviewText";
import { createClient } from "@/lib/supabase/client";
import { useLoginHref } from "@/lib/useLoginHref";
import AdminBadge from "./AdminBadge";
import ReviewTextarea from "./ReviewTextArea";

export type CommentItem = {
  id: string;
  parentId: string | null;
  body: string;
  date: string;
  authorId: string;
  authorName: string;
  likeCount: number;
  liked: boolean;
  authorIsAdmin?: boolean;
};

export default function Comments({
  comments,
  viewerId,
  table,
  scope,
  ownerId,
  likeable = false,
}: {
  comments: CommentItem[];
  viewerId: string | null;
  // "comments" for reviews, "list_comments" for lists
  table: "comments" | "list_comments";
  // The columns that tie a comment to what it's on
  scope: Record<string, string>;
  // The owner of the review or list can delete any comment on it
  ownerId: string;
  // Only review comments can be liked
  likeable?: boolean;
}) {
  const loginHref = useLoginHref();
  const [topText, setTopText] = useState<string>("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  const topLevel = comments.filter((c) => c.parentId === null);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  async function post(body: string, parentId: string | null): Promise<boolean> {
    if (!viewerId) return false;
    const trimmed = body.trim();
    if (trimmed.length < 1 || trimmed.length > 1000) {
      setError("Comments are 1–1000 characters.");
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
        body: trimmed,
      });
    setBusy(false);

    if (error) {
      setError(error.message);
      return false;
    }
    router.refresh();
    return true;
  }

  async function submitTop(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (await post(topText, null)) setTopText("");
  }

  async function submitReply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (replyTo && (await post(replyText, replyTo))) {
      setReplyTo(null);
      setReplyText("");
    }
  }

  async function handleDelete(c: CommentItem) {
    const hasReplies = repliesOf(c.id).length > 0;
    const message = hasReplies
      ? "Delete this comment and its replies?"
      : "Delete this comment?";
    if (!window.confirm(message)) return;

    setBusy(true);
    setError("");
    const { error } = await createClient().from(table).delete().eq("id", c.id);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  function renderComment(c: CommentItem, rootId: string) {
    const canDelete = viewerId === c.authorId || viewerId === ownerId;
    return (
      <div key={c.id} className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/u/${encodeURIComponent(c.authorName)}`}
            className="font-semibold underline"
          >
            {c.authorName}
          </Link>
          {c.authorIsAdmin && <AdminBadge />}
          <span className="text-xs text-muted">{c.date}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm">
          <ReviewText text={c.body} />
        </p>
        <div className="flex gap-3 text-xs text-muted">
          {likeable && (
            <CommentLikeButton
              viewerId={viewerId}
              commentId={c.id}
              authorId={c.authorId}
              initialCount={c.likeCount}
              initiallyLiked={c.liked}
            />
          )}
          {viewerId && (
            <button
              type="button"
              onClick={() => {
                setReplyTo(rootId);
                setReplyText(c.parentId ? `@${c.authorName} ` : "");
                setError("");
              }}
              className="underline"
            >
              Reply
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => handleDelete(c)}
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
        {comments.length === 0
          ? "No comments yet"
          : `${comments.length} ${comments.length === 1 ? "comment" : "comments"}`}
      </h2>

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
          />
          <button
            type="submit"
            disabled={busy || topText.trim().length === 0}
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
