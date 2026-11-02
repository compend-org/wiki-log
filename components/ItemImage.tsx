import { shortLabel } from "@/lib/format";

// Picks a font size, in % of the box's width, so the name fills most of the
// box: short names get big text, long ones get smaller text. The size also
// keeps the longest word within the width of the box.
function labelSize(label: string): number {
  const length = Math.max(1, Array.from(label).length);
  const longestWord = Math.max(
    1,
    ...label.split(/\s+/).map((word) => Array.from(word).length)
  );
  return Math.min(52, 110 / Math.sqrt(length), 180 / longestWord);
}

export default function ItemImage({
  src,
  alt,
  className = "",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  if (!src) {
    const label = shortLabel(alt);
    const size = labelSize(label).toFixed(1);

    return (
      <div
        role="img"
        aria-label={alt}
        // Lets the text size itself from the width of this box
        style={{ containerType: "inline-size", padding: "4px" }}
        className={`flex items-center justify-center overflow-hidden border border-line bg-surface text-center text-muted ${className}`}
      >
        <span
          style={{
            display: "block",
            maxWidth: "100%",
            fontWeight: 700,
            fontSize: `clamp(8px, ${size}cqw, 72px)`,
            lineHeight: 1.15,
            overflowWrap: "anywhere",
          }}
        >
          {label}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={`object-cover ${className}`}
    />
  );
}