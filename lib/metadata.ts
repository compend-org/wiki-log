// ABOUTME: Builds the metadata a page shows in link previews: title, description and image.
// ABOUTME: Keeps the Open Graph and Twitter card fields in step with each other.
import type { Metadata } from "next";
import { absolute } from "@/lib/format";
import { SITE_NAME } from "@/lib/site";

// A square image, like an avatar, is shown as a small thumbnail beside the
// text; any other image is shown large above it
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
  const images = image ? [absolute(image)] : undefined;
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
      card: images && !squareImage ? "summary_large_image" : "summary",
      title,
      description,
      images,
    },
  };
}
