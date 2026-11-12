// ABOUTME: Server-only automatic check of a review's or comment's new image with OpenAI's moderation model.
// ABOUTME: Also makes the photo's smaller copies; flagged posts are removed, their files hidden, and a report filed.
import sharp from "sharp";
import {
  type CategoryScores,
  framesToCheck,
  imageVerdict,
  verdictDetails,
} from "@/lib/imageModeration";
import { hidePostImageFiles } from "@/lib/postImageFiles";
import {
  copyPath,
  POST_IMAGE_COPIES,
  POST_IMAGES_BUCKET,
  type PostImageCopy,
  type PostImageTable,
  storedFiles,
} from "@/lib/postImages";
import { createAdminClient } from "@/lib/supabase/admin";

// What each table's posts are called in reports
const REPORT_KIND: Record<PostImageTable, "log" | "comment" | "list_comment"> =
  {
    logs: "log",
    comments: "comment",
    list_comments: "list_comment",
  };

export type CheckResult =
  | { outcome: "skipped"; why: string }
  | { outcome: "kept" | "removed"; scores: CategoryScores }
  | { outcome: "failed"; error: string };

// The images to send for one stored file, as data URLs: the file itself, or
// a spread of frames for a GIF, since OpenAI only looks at a GIF's first one
async function imagesToSend(file: Blob, bytes: Buffer): Promise<string[]> {
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

// Stores the photo's smaller copies beside it. Made here rather than in the
// browser, so the copies people see are the photo that was checked.
async function makeCopies(path: string, bytes: Buffer): Promise<void> {
  const storage = createAdminClient().storage.from(POST_IMAGES_BUCKET);
  await Promise.all(
    (Object.keys(POST_IMAGE_COPIES) as PostImageCopy[]).map(async (copy) => {
      const target = copyPath(path, copy);
      if (!target) return;
      const jpeg = await sharp(bytes)
        .resize({
          ...POST_IMAGE_COPIES[copy],
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();
      const { error } = await storage.upload(target, jpeg, {
        contentType: "image/jpeg",
        // Short, so a removed image stops being served from caches soon
        cacheControl: "3600",
        upsert: true,
      });
      if (error) throw new Error(`Couldn't store ${target}: ${error.message}`);
    }),
  );
}

// Checks the post's images once. A failure leaves them unchecked, so the
// database's retry job asks again later; the images stay up meanwhile.
export async function checkPostImages(
  table: PostImageTable,
  postId: string,
): Promise<CheckResult> {
  const admin = createAdminClient();
  const { data: post, error: readError } = await admin
    .from(table)
    .select("images, images_checked_at, removed_at")
    .eq("id", postId)
    .maybeSingle();
  if (readError) return { outcome: "failed", error: readError.message };
  if (!post) return { outcome: "skipped", why: "deleted" };
  if (post.images_checked_at) return { outcome: "skipped", why: "checked" };
  // A moderator already removed it, so its files are hidden
  if (post.removed_at) return { outcome: "skipped", why: "removed" };
  const paths = post.images as string[];
  if (paths.length === 0) return { outcome: "skipped", why: "no images" };

  let scores: CategoryScores[];
  try {
    const images = await Promise.all(
      paths.map(async (path) => {
        const { data, error } = await admin.storage
          .from(POST_IMAGES_BUCKET)
          .download(path);
        if (error) throw new Error(`Couldn't read ${path}: ${error.message}`);
        const bytes = Buffer.from(await data.arrayBuffer());
        const [toSend] = await Promise.all([
          imagesToSend(data, bytes),
          makeCopies(path, bytes),
        ]);
        return toSend;
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

  if (verdict.reason) {
    // Records the check, removes the post and files the report together.
    // Only the first check to finish acts, if two ever run at once, and only
    // while the post still has the images this one looked at.
    const { data: removed, error: removeError } = await admin.rpc(
      "auto_remove_post",
      {
        p_kind: REPORT_KIND[table],
        p_id: postId,
        p_images: paths,
        p_reason: verdict.reason,
        p_details: verdictDetails(verdict),
        p_scores: verdict.maxScores,
      },
    );
    if (removeError) return { outcome: "failed", error: removeError.message };
    if (!removed) return { outcome: "skipped", why: "checked or changed" };

    // Nothing retries this, so a failure here is reported to Sentry by the
    // route for someone to move the files by hand
    const files = paths.flatMap(storedFiles);
    const stillPublic = await hidePostImageFiles(files);
    if (stillPublic > 0) {
      return {
        outcome: "failed",
        error: `Removed, but ${stillPublic} file(s) are still public: ${files.join(", ")}`,
      };
    }
    return { outcome: "removed", scores: verdict.maxScores };
  }

  // Only the first check to finish records it, if two ever run at once, and
  // only while the post still has the images this one looked at
  const { data: claimed, error: saveError } = await admin
    .from(table)
    .update({
      images_checked_at: new Date().toISOString(),
      image_scores: verdict.maxScores,
    })
    .eq("id", postId)
    .is("images_checked_at", null)
    .eq("images", `{${paths.join(",")}}`)
    .select("id");
  if (saveError) return { outcome: "failed", error: saveError.message };
  if (!claimed?.length)
    return { outcome: "skipped", why: "checked or changed" };
  return { outcome: "kept", scores: verdict.maxScores };
}
