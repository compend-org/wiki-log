import ItemPicture from "@/components/ItemPicture";
import { shortLabel } from "@/lib/format";

const CHAR_WIDTH = 0.66; // average width of a bold character, in em (a little generous)
const LINE_HEIGHT = 1.15;
const PAD = 6; // padding inside the box, in the box's own 0–100 units
const MIN_SIZE = 3;

// Breaks the words into lines of at most maxChars characters, only at spaces.
// A word is never split, so a line can be longer than maxChars only when one
// word alone is.
function wrap(words: string[], maxChars: number): string[] {
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    if (!line) {
      line = word;
    } else if (
      Array.from(line).length + 1 + Array.from(word).length <=
      maxChars
    ) {
      line = `${line} ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// The largest font size at which the name fits the box without breaking a word
function layout(label: string, width: number, height: number) {
  const words = label.split(/\s+/).filter(Boolean);
  const longest = Math.max(1, ...words.map((w) => Array.from(w).length));

  const innerW = width - PAD * 2;
  const innerH = height - PAD * 2;

  // Never bigger than what lets the longest word fit on one line
  const widest = innerW / (longest * CHAR_WIDTH);
  const start = Math.min(innerH * 0.6, 56, widest);

  for (let size = start; size >= MIN_SIZE; size -= 0.5) {
    const maxChars = Math.max(
      longest,
      Math.floor(innerW / (size * CHAR_WIDTH)),
    );
    const lines = wrap(words, maxChars);
    if (lines.length * size * LINE_HEIGHT <= innerH) return { size, lines };
  }

  return {
    size: MIN_SIZE,
    lines: wrap(
      words,
      Math.max(longest, Math.floor(innerW / (MIN_SIZE * CHAR_WIDTH))),
    ),
  };
}

export default function ItemImage({
  src,
  alt,
  className = "",
  ratio = 1,
  placeholder = alt,
  sourceWidth,
  nsfw = false,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  // Width divided by height of the box, for boxes that aren't square
  ratio?: number;
  // The text shown in the box when there is no image
  placeholder?: string;
  // The widest image to fetch, in pixels, for boxes that only show it small
  sourceWidth?: number;
  // Adult content, blurred and labelled in SFW mode until tapped
  nsfw?: boolean;
}) {
  if (!src) {
    const width = 100 * ratio;
    const height = 100;
    const { size, lines } = layout(shortLabel(placeholder), width, height);
    const lineHeight = size * LINE_HEIGHT;
    const top = (height - lines.length * lineHeight) / 2;

    return (
      <svg
        role="img"
        aria-label={alt}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className={`block border border-line bg-surface text-muted ${className}`}
      >
        <text
          textAnchor="middle"
          fill="currentColor"
          fontWeight="bold"
          fontSize={size}
        >
          {lines.map((line, i) => (
            <tspan
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed-order list whose entries can repeat
              key={i}
              x={width / 2}
              y={top + i * lineHeight + lineHeight / 2 + size * 0.33}
            >
              {line}
            </tspan>
          ))}
        </text>
      </svg>
    );
  }

  return (
    <ItemPicture
      src={src}
      sourceWidth={sourceWidth}
      alt={alt}
      nsfw={nsfw}
      loading="lazy"
      draggable={false}
      className={`item-img object-cover [[data-theme=dark]_&]:bg-foreground ${className}`}
    />
  );
}
