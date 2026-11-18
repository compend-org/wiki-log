// ABOUTME: Builds the metadata a page shows in link previews and search results: title, description, image and address.
// ABOUTME: Keeps the Open Graph and Twitter card fields in step with each other.
import type { Metadata } from "next";
import { absolute, truncate } from "@/lib/format";
import { isCompoundId } from "@/lib/ids";
import { SITE_NAME, SITE_PREVIEW_IMAGE } from "@/lib/site";

// Search results show about this many characters of a description
const DESCRIPTION_LENGTH = 160;

// The text on one line, cut at a word to fit a search result
export function shortDescription(text: string): string {
  return truncate(text.replace(/\s+/g, " ").trim(), DESCRIPTION_LENGTH);
}

// A square image, like an avatar, is shown as a small thumbnail beside the
// text; any other image is shown large above it. A page without an image
// shows the site logo as a thumbnail. `path` is the page's own address,
// without the query, so search engines treat its variants as one page
export function pageMetadata({
  title,
  description: fullDescription,
  image,
  squareImage = false,
  path,
}: {
  title: string;
  description?: string;
  image?: string | null;
  squareImage?: boolean;
  path?: string;
}): Metadata {
  const images = [image ? absolute(image) : SITE_PREVIEW_IMAGE];
  const description = fullDescription && shortDescription(fullDescription);
  return {
    title,
    // Left out when empty, so the site's description still applies. Open
    // Graph and Twitter cards take theirs from it.
    ...(description && { description }),
    ...(path && { alternates: { canonical: path } }),
    openGraph: {
      title,
      url: path,
      images,
      siteName: SITE_NAME,
      type: "website",
    },
    twitter: {
      card: image && !squareImage ? "summary_large_image" : "summary",
      title,
      images,
    },
  };
}

// Link preview fields for an item's picture, served at a size previews can
// show. A compound's drawing is square, so it shows as a thumbnail, and its
// address changes with each new drawing, so previews never keep an old one.
export function itemPreviewImage(
  itemId: string,
  imageUrl: string,
): { image: string; squareImage: boolean } {
  const version = imageUrl.split("?")[1];
  return {
    image: `/item/${itemId}/image${version ? `?${version}` : ""}`,
    squareImage: isCompoundId(itemId),
  };
}

// What a search result says about an item: what it is, then how people rated it
export function itemDescription({
  title,
  about,
  ratings,
}: {
  title: string;
  about: string | null;
  ratings: number[];
}): string {
  const summary = about && `${about.charAt(0).toUpperCase()}${about.slice(1)}.`;
  const people = ratings.length;
  const average = ratings.reduce((sum, r) => sum + r, 0) / people;
  const rated =
    people === 0
      ? `Rate and review ${title} on ${SITE_NAME}.`
      : `Rated ${average.toFixed(1)} out of 5 by ${people} ${people === 1 ? "person" : "people"} on ${SITE_NAME}. See their reviews and the lists it's on.`;
  return summary ? `${summary} ${rated}` : rated;
}
