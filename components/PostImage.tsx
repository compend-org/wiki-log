// ABOUTME: Shows the image or GIF attached to a review or comment, at the size of copy asked for.
// ABOUTME: Can link to the full file; on cards it leaves clicks to the card's own link instead.
import { type PostImageSize, postImageUrl } from "@/lib/postImages";

export default function PostImage({
  path,
  checked,
  size,
  className,
  linkToFull = false,
}: {
  // Where the image is in the post-images bucket
  path: string;
  // Whether the automatic check has passed it, which is when its smaller
  // copies are made
  checked: boolean;
  size: PostImageSize;
  className: string;
  // Whether clicking it opens the full file in a new tab
  linkToFull?: boolean;
}) {
  const image = (
    // biome-ignore lint/performance/noImgElement: a plain img is intended
    <img
      src={postImageUrl(path, size, checked)}
      alt=""
      loading="lazy"
      draggable={false}
      className={className}
    />
  );
  if (!linkToFull) return image;
  return (
    <a
      href={postImageUrl(path)}
      target="_blank"
      rel="noopener noreferrer"
      className="relative z-10 w-fit max-w-full"
    >
      {image}
    </a>
  );
}
