// ABOUTME: Tests for post image paths, copies, URLs and resizing.
// ABOUTME: Paths must pass the database's check, which only accepts a UUID name in the uploader's folder.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  copyPath,
  fitWithin,
  postImagePath,
  postImageProblem,
  postImageUrl,
  storedFiles,
} from "./postImages";

const MB = 1024 * 1024;

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

const userId = "b4042436-397a-4e3d-ba4b-9075f44f7ddf";
// The pattern in post_image_paths_valid()
const databaseCheck = new RegExp(`^${userId}/[0-9a-f-]{36}\\.(jpg|gif)$`);

test("puts new images in their uploader's folder under a random name", () => {
  const jpg = postImagePath(userId, "jpg");
  const gif = postImagePath(userId, "gif");
  assert.match(jpg, databaseCheck);
  assert.match(gif, databaseCheck);
  assert.ok(gif.endsWith(".gif"));
  assert.notEqual(jpg, postImagePath(userId, "jpg"));
});

const bucketUrl =
  "https://example.supabase.co/storage/v1/object/public/post-images";

test("serves images from the public bucket", () => {
  assert.equal(postImageUrl(`${userId}/a.gif`), `${bucketUrl}/${userId}/a.gif`);
});

test("serves a photo's copy once it has been checked", () => {
  assert.equal(
    postImageUrl(`${userId}/a.jpg`, "small"),
    `${bucketUrl}/${userId}/a-small.jpg`,
  );
  assert.equal(
    postImageUrl(`${userId}/a.jpg`, "medium"),
    `${bucketUrl}/${userId}/a-medium.jpg`,
  );
});

test("serves the full photo until it has been checked, since its copies don't exist yet", () => {
  assert.equal(
    postImageUrl(`${userId}/a.jpg`, "small", false),
    `${bucketUrl}/${userId}/a.jpg`,
  );
});

test("serves GIFs whole at every size, so they keep moving", () => {
  assert.equal(
    postImageUrl(`${userId}/a.gif`, "small"),
    `${bucketUrl}/${userId}/a.gif`,
  );
  assert.equal(copyPath(`${userId}/a.gif`, "small"), null);
});

test("names copies so the database's check never accepts one as a post's image", () => {
  const path = postImagePath(userId, "jpg");
  for (const copy of ["small", "medium"] as const) {
    assert.doesNotMatch(copyPath(path, copy) ?? "", databaseCheck);
  }
});

test("lists every file stored for an image", () => {
  assert.deepEqual(storedFiles(`${userId}/a.jpg`), [
    `${userId}/a.jpg`,
    `${userId}/a-small.jpg`,
    `${userId}/a-medium.jpg`,
  ]);
  assert.deepEqual(storedFiles(`${userId}/a.gif`), [`${userId}/a.gif`]);
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
  assert.equal(postImageProblem({ type: "image/png", size: 9 * MB }), null);
  assert.equal(postImageProblem({ type: "image/gif", size: 5 * MB }), null);
});

test("refuses files that aren't images", () => {
  assert.equal(
    postImageProblem({ type: "video/mp4", size: 1 }),
    "Please choose an image or GIF.",
  );
});

test("refuses GIFs over the bucket's limit, since they're stored as they are", () => {
  assert.equal(
    postImageProblem({ type: "image/gif", size: 5 * MB + 1 }),
    "GIFs can be up to 5 MB.",
  );
});

test("refuses huge photos", () => {
  assert.equal(
    postImageProblem({ type: "image/jpeg", size: 10 * MB + 1 }),
    "Images can be up to 10 MB.",
  );
});
