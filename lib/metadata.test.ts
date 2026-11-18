// ABOUTME: Tests for the metadata pages show in link previews and search results.
// ABOUTME: Covers the preview image, the description's length and wording, and the page's address.
import assert from "node:assert/strict";
import { test } from "node:test";
import { itemDescription, pageMetadata, shortDescription } from "./metadata";
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

test("keeps a short description as it is, on one line", () => {
  assert.equal(shortDescription("  A list\n of  films "), "A list of films");
});

test("cuts a long description at a word to fit a search result", () => {
  const description = shortDescription(`${"word ".repeat(40)}end`);
  assert.ok(description.length <= 160);
  assert.match(description, /word…$/);
});

test("gives a page's address as its canonical and Open Graph address", () => {
  const metadata = pageMetadata({ title: "Machine", path: "/item/Q11019" });
  assert.equal(metadata.alternates?.canonical, "/item/Q11019");
  assert.equal(
    metadata.openGraph && "url" in metadata.openGraph && metadata.openGraph.url,
    "/item/Q11019",
  );
});

test("leaves the canonical address out when the page gives none", () => {
  assert.equal(pageMetadata({ title: "Somebody" }).alternates, undefined);
});

test("describes a rated item and how people rated it", () => {
  assert.equal(
    itemDescription({
      title: "Machine",
      about: "powered mechanical device",
      ratings: [4, 5, 3.5],
    }),
    "Powered mechanical device. Rated 4.2 out of 5 by 3 people on compend. See their reviews and the lists it's on.",
  );
});

test("invites the first rating of an unrated item", () => {
  assert.equal(
    itemDescription({ title: "Machine", about: null, ratings: [] }),
    "Rate and review Machine on compend.",
  );
});
