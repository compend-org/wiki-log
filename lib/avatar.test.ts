// ABOUTME: Tests for profile picture paths and URLs.
// ABOUTME: Covers where the small copy lives and which copy each display size loads.
import assert from "node:assert/strict";
import { test } from "node:test";
import { avatarUrl, smallAvatarPath } from "./avatar";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
const base = "https://example.supabase.co/storage/v1/object/public/avatars";

test("stores the small copy next to the full picture", () => {
  assert.equal(smallAvatarPath("user-1/123.jpg"), "user-1/123-small.jpg");
});

test("has no URL without a picture", () => {
  assert.equal(avatarUrl(null, 16), null);
  assert.equal(avatarUrl(undefined), null);
  assert.equal(avatarUrl(""), null);
});

test("loads the full picture when no display size is given", () => {
  assert.equal(avatarUrl("user-1/123.jpg"), `${base}/user-1/123.jpg`);
});

test("loads the small copy for tiny displays", () => {
  assert.equal(avatarUrl("user-1/123.jpg", 16), `${base}/user-1/123-small.jpg`);
  assert.equal(avatarUrl("user-1/123.jpg", 20), `${base}/user-1/123-small.jpg`);
});

test("loads the full picture once the small copy would look blurry", () => {
  assert.equal(avatarUrl("user-1/123.jpg", 32), `${base}/user-1/123.jpg`);
  assert.equal(avatarUrl("user-1/123.jpg", 80), `${base}/user-1/123.jpg`);
});
