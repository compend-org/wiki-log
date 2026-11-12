// ABOUTME: Called by the database after a review or comment gets an image, and by its retry job.
// ABOUTME: Checks the image with OpenAI and removes the post when it's flagged.
import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { POSTS_CACHE_TAG } from "@/lib/cacheTags";
import { checkPostImages } from "@/lib/checkPostImages";
import { isUuid } from "@/lib/ids";
import { POST_IMAGE_TABLES, type PostImageTable } from "@/lib/postImages";

// Downloading the image and checking up to 4 GIF frames at once
export const maxDuration = 60;

// Whether the request carries the secret the database was given
function fromDatabase(request: NextRequest): boolean {
  const expected = process.env.POST_IMAGE_CHECK_SECRET;
  const given = request.headers.get("x-post-image-check-secret");
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
  const table = body?.table as PostImageTable;
  const id = body?.id;
  if (
    !POST_IMAGE_TABLES.includes(table) ||
    typeof id !== "string" ||
    !isUuid(id)
  ) {
    return NextResponse.json({ error: "Invalid post" }, { status: 400 });
  }

  const result = await checkPostImages(table, id);
  // The feeds keep a copy of reviews for a few minutes. Refreshing it drops a
  // removed review, and has a kept one show its image's smaller copies.
  if (table === "logs" && result.outcome !== "skipped") {
    revalidateTag(POSTS_CACHE_TAG, { expire: 0 });
  }
  if (result.outcome === "failed") {
    Sentry.captureMessage(`Post image check failed: ${result.error}`, {
      level: "error",
      tags: { table },
      extra: { postId: id },
    });
    return NextResponse.json(result, { status: 502 });
  }
  return NextResponse.json(result);
}
