// ABOUTME: Server-only automatic check of a new comment's images with OpenAI's moderation model.
// ABOUTME: Flagged comments are removed, their files hidden, and an open report filed for the moderators.
import sharp from "sharp";
import { hideCommentImageFiles } from "@/lib/commentImageFiles";
import { COMMENT_IMAGES_BUCKET } from "@/lib/commentImages";
import type { CommentTable } from "@/lib/comments";
import {
  type CategoryScores,
  framesToCheck,
  imageVerdict,
  verdictDetails,
} from "@/lib/imageModeration";
import { createAdminClient } from "@/lib/supabase/admin";

// What each comment table's comments are called in reports
const REPORT_KIND: Record<CommentTable, "comment" | "list_comment"> = {
  comments: "comment",
  list_comments: "list_comment",
};

export type CheckResult =
  | { outcome: "skipped"; why: string }
  | { outcome: "kept" | "removed"; scores: CategoryScores }
  | { outcome: "failed"; error: string };

// The images to send for one stored file, as data URLs: the file itself, or
// a spread of frames for a GIF, since OpenAI only looks at a GIF's first one
async function imagesToSend(file: Blob): Promise<string[]> {
  const bytes = Buffer.from(await file.arrayBuffer());
  if (file.type !== "image/gif") {
    return [`data:${file.type};base64,${bytes.toString("base64")}`];
  }
  const { pages = 1 } = await sharp(bytes).metadata();
  return Promise.all(
    framesToCheck(pages).map(async (page) => {
      const jpeg = await sharp(bytes, { page }).jpeg().toBuffer();
      return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
    }),
  );
}

// OpenAI's scores for one image. It accepts one image per request.
async function moderate(dataUrl: string): Promise<CategoryScores> {
  const res = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input: [{ type: "image_url", image_url: { url: dataUrl } }],
    }),
  });
  if (!res.ok) {
    throw new Error(
      `OpenAI moderation failed: ${res.status} ${await res.text()}`,
    );
  }
  const body = await res.json();
  return body.results[0].category_scores;
}

// Checks the comment's images once. A failure leaves it unchecked, so the
// database's retry job asks again later; the images stay up meanwhile.
export async function checkCommentImages(
  table: CommentTable,
  commentId: string,
): Promise<CheckResult> {
  const admin = createAdminClient();
  const { data: comment, error: readError } = await admin
    .from(table)
    .select("images, images_checked_at, removed_at")
    .eq("id", commentId)
    .maybeSingle();
  if (readError) return { outcome: "failed", error: readError.message };
  if (!comment) return { outcome: "skipped", why: "deleted" };
  if (comment.images_checked_at) return { outcome: "skipped", why: "checked" };
  // A moderator already removed it, so its files are hidden
  if (comment.removed_at) return { outcome: "skipped", why: "removed" };
  const paths = comment.images as string[];
  if (paths.length === 0) return { outcome: "skipped", why: "no images" };

  let scores: CategoryScores[];
  try {
    const images = await Promise.all(
      paths.map(async (path) => {
        const { data, error } = await admin.storage
          .from(COMMENT_IMAGES_BUCKET)
          .download(path);
        if (error) throw new Error(`Couldn't read ${path}: ${error.message}`);
        return imagesToSend(data);
      }),
    );
    scores = await Promise.all(images.flat().map(moderate));
  } catch (e) {
    return {
      outcome: "failed",
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const verdict = imageVerdict(scores);

  // Only the first check to finish acts, if two ever run at once
  const { data: claimed, error: saveError } = await admin
    .from(table)
    .update({
      images_checked_at: new Date().toISOString(),
      image_scores: verdict.maxScores,
    })
    .eq("id", commentId)
    .is("images_checked_at", null)
    .select("id");
  if (saveError) return { outcome: "failed", error: saveError.message };
  if (!claimed?.length) return { outcome: "skipped", why: "checked" };

  if (!verdict.reason) return { outcome: "kept", scores: verdict.maxScores };

  const { error: removeError } = await admin.rpc("auto_remove_comment", {
    p_kind: REPORT_KIND[table],
    p_id: commentId,
    p_reason: verdict.reason,
    p_details: verdictDetails(verdict),
  });
  if (removeError) return { outcome: "failed", error: removeError.message };
  const stillPublic = await hideCommentImageFiles(paths);
  if (stillPublic > 0) {
    return {
      outcome: "failed",
      error: `Removed, but ${stillPublic} image(s) are still public`,
    };
  }
  return { outcome: "removed", scores: verdict.maxScores };
}
