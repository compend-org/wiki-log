// ABOUTME: Tests for comment image paths, URLs and resizing.
// ABOUTME: Paths must pass the database's check, which only accepts a UUID name in the uploader's folder.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  commentImagePath,
  commentImageProblem,
  commentImageUrl,
  fitWithin,
} from "./commentImages";

const MB = 1024 * 1024;

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

const userId = "b4042436-397a-4e3d-ba4b-9075f44f7ddf";
// The pattern in comment_image_paths_valid()
const databaseCheck = new RegExp(`^${userId}/[0-9a-f-]{36}\\.(jpg|gif)$`);

test("puts new images in their uploader's folder under a random name", () => {
  const jpg = commentImagePath(userId, "jpg");
  const gif = commentImagePath(userId, "gif");
  assert.match(jpg, databaseCheck);
  assert.match(gif, databaseCheck);
  assert.ok(gif.endsWith(".gif"));
  assert.notEqual(jpg, commentImagePath(userId, "jpg"));
});

test("serves images from the public bucket", () => {
  assert.equal(
    commentImageUrl(`${userId}/a.gif`),
    `https://example.supabase.co/storage/v1/object/public/comment-images/${userId}/a.gif`,
  );
});

test("shrinks big pictures to fit, keeping their shape", () => {
  assert.deepEqual(fitWithin(4000, 3000, 1600), { width: 1600, height: 1200 });
  assert.deepEqual(fitWithin(1000, 5000, 1600), { width: 320, height: 1600 });
});

test("leaves small pictures their size", () => {
  assert.deepEqual(fitWithin(800, 600, 1600), { width: 800, height: 600 });
});

test("never shrinks a side to nothing", () => {
  assert.deepEqual(fitWithin(10000, 1, 1600), { width: 1600, height: 1 });
});

test("accepts photos and GIFs within their limits", () => {
  assert.equal(commentImageProblem({ type: "image/png", size: 9 * MB }), null);
  assert.equal(commentImageProblem({ type: "image/gif", size: 5 * MB }), null);
});

test("refuses files that aren't images", () => {
  assert.equal(
    commentImageProblem({ type: "video/mp4", size: 1 }),
    "Please choose an image or GIF.",
  );
});

test("refuses GIFs over the bucket's limit, since they're stored as they are", () => {
  assert.equal(
    commentImageProblem({ type: "image/gif", size: 5 * MB + 1 }),
    "GIFs can be up to 5 MB.",
  );
});

test("refuses huge photos", () => {
  assert.equal(
    commentImageProblem({ type: "image/jpeg", size: 10 * MB + 1 }),
    "Images can be up to 10 MB.",
  );
});
