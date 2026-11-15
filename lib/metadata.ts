// ABOUTME: Builds the metadata a page shows in link previews: title, description and image.
// ABOUTME: Keeps the Open Graph and Twitter card fields in step with each other.
import type { Metadata } from "next";
import { absolute } from "@/lib/format";
import { isCompoundId } from "@/lib/ids";
import { SITE_NAME, SITE_PREVIEW_IMAGE } from "@/lib/site";

// A square image, like an avatar, is shown as a small thumbnail beside the
// text; any other image is shown large above it. A page without an image
// shows the site logo as a thumbnail
export function pageMetadata({
  title,
  description,
  image,
  squareImage = false,
}: {
  title: string;
  description?: string;
  image?: string | null;
  squareImage?: boolean;
}): Metadata {
  const images = [image ? absolute(image) : SITE_PREVIEW_IMAGE];
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images,
      siteName: SITE_NAME,
      type: "website",
    },
    twitter: {
      card: image && !squareImage ? "summary_large_image" : "summary",
      title,
      description,
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
