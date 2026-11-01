"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type CommentItem = {
  id: string;
  parentId: string | null;
  body: string;
  date: string;
  authorId: string;
  authorName: string;
};

export default function Comments({
  comments,
  viewerId,
  logUserId,
  logVideoId,
}: {
  comments: CommentItem[];
  viewerId: string | null;
  logUserId: string;
  logVideoId: string;
}) {
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
    const { error } = await createClient().from("comments").insert({
      log_user_id: logUserId,
      log_video_id: logVideoId,
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
    const { error } = await createClient()
      .from("comments")
      .delete()
      .eq("id", c.id);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  function renderComment(c: CommentItem, rootId: string) {
    const canDelete = viewerId === c.authorId || viewerId === logUserId;
    return (
      <div key={c.id} className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/u/${encodeURIComponent(c.authorName)}`}
            className="font-semibold underline"
          >
            {c.authorName}
          </Link>
          <span className="text-xs text-muted">{c.date}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm">{c.body}</p>
        <div className="flex gap-3 text-xs text-muted">
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
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">
        {comments.length === 0
          ? "No comments yet"
          : `${comments.length} ${comments.length === 1 ? "comment" : "comments"}`}
      </h2>

      {topLevel.map((c) => {
        const replies = repliesOf(c.id);
        return (
          <div
            key={c.id}
            className="flex flex-col gap-3 rounded-lg border border-line p-3"
          >
            {renderComment(c, c.id)}

            {replies.length > 0 && (
              <div className="ml-3 flex flex-col gap-3 border-l border-line pl-3">
                {replies.map((r) => renderComment(r, c.id))}
              </div>
            )}

            {replyTo === c.id && (
              <form onSubmit={submitReply} className="ml-3 flex flex-col gap-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
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
          <textarea
            value={topText}
            onChange={(e) => setTopText(e.target.value)}
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
          <Link href="/login" className="underline">
            Sign in
          </Link>{" "}
          to comment.
        </p>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}