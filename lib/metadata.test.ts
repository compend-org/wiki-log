// ABOUTME: Tests for the metadata pages show in link previews.
// ABOUTME: Covers which image a preview uses and how large the card shows it.
import assert from "node:assert/strict";
import { test } from "node:test";
import { pageMetadata } from "./metadata";
import { SITE_PREVIEW_IMAGE } from "./site";

function previewImages(metadata: ReturnType<typeof pageMetadata>) {
  return {
    openGraph: metadata.openGraph?.images,
    twitter: metadata.twitter?.images,
  };
}

test("shows the site logo when the page has no image", () => {
  const metadata = pageMetadata({ title: "Somebody", image: null });
  assert.deepEqual(previewImages(metadata), {
    openGraph: [SITE_PREVIEW_IMAGE],
    twitter: [SITE_PREVIEW_IMAGE],
  });
  assert.equal(
    metadata.twitter && "card" in metadata.twitter && metadata.twitter.card,
    "summary",
  );
});

test("shows the page's own image large", () => {
  const metadata = pageMetadata({
    title: "A film",
    image: "//upload.wikimedia.org/poster.jpg",
  });
  assert.deepEqual(previewImages(metadata), {
    openGraph: ["https://upload.wikimedia.org/poster.jpg"],
    twitter: ["https://upload.wikimedia.org/poster.jpg"],
  });
  assert.equal(
    metadata.twitter && "card" in metadata.twitter && metadata.twitter.card,
    "summary_large_image",
  );
});
