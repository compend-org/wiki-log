// ABOUTME: Called by the database after a comment with images is posted, and by its retry job.
// ABOUTME: Checks the images with OpenAI and removes the comment when they're flagged.
import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import { checkCommentImages } from "@/lib/checkCommentImages";
import { COMMENT_TABLES, type CommentTable } from "@/lib/comments";
import { isUuid } from "@/lib/ids";

// Downloading the image and checking up to 4 GIF frames at once
export const maxDuration = 60;

// Whether the request carries the secret the database was given
function fromDatabase(request: NextRequest): boolean {
  const expected = process.env.COMMENT_IMAGE_CHECK_SECRET;
  const given = request.headers.get("x-comment-image-check-secret");
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!fromDatabase(request)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const table = body?.table as CommentTable;
  const id = body?.id;
  if (
    !COMMENT_TABLES.includes(table) ||
    typeof id !== "string" ||
    !isUuid(id)
  ) {
    return NextResponse.json({ error: "Invalid comment" }, { status: 400 });
  }

  const result = await checkCommentImages(table, id);
  if (result.outcome === "failed") {
    Sentry.captureMessage(`Comment image check failed: ${result.error}`, {
      level: "error",
      tags: { table },
      extra: { commentId: id },
    });
    return NextResponse.json(result, { status: 502 });
  }
  return NextResponse.json(result);
}
