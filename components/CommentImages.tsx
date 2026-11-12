// ABOUTME: Shows the images and GIFs attached to a comment, each linking to its full size.
// ABOUTME: A fixed height keeps comments from jumping around while images load.
import { commentImageUrl } from "@/lib/commentImages";

export default function CommentImages({ paths }: { paths: string[] }) {
  if (paths.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {paths.map((path) => {
        const url = commentImageUrl(path);
        return (
          <a key={path} href={url} target="_blank" rel="noopener noreferrer">
            {/* biome-ignore lint/performance/noImgElement: a plain img is intended */}
            <img
              src={url}
              alt=""
              loading="lazy"
              draggable={false}
              className="h-40 w-auto max-w-full rounded-lg border border-line object-contain"
            />
          </a>
        );
      })}
    </div>
  );
}
