// ABOUTME: Lays out a review's text, with its TeX math drawn, for the images people share from the site.
// ABOUTME: The renderer can't put pictures inside a paragraph, so math reviews are laid out word by word.
import { type ReviewPiece, reviewPieces } from "@/lib/format";
import { texPicture } from "@/lib/texPicture";

// KaTeX draws math a little bigger than the text around it
const MATH_SIZE = 1.21;

// The colour KaTeX shows TeX it can't read in
const ERROR_COLOR = "#cc0000";

// How far above a line's bottom its text sits, in ems, for Tinos at a line
// height of 1.5: half the gap left by the font's height, then its descent
const BASELINE = (1.5 - 0.891 - 0.216) / 2 + 0.216;

type Word = { text: string; color?: string };
type MathBox = { src: string; width: number; height: number; depth: number };
type Row = { words: (Word | MathBox)[] } | { display: MathBox };

// A review's text, cut off after `lines` lines of `fontSize` text in a box
// `width` wide. Math is drawn; text without math wraps like any paragraph.
export default function ReviewImageText({
  text,
  fontSize,
  lines,
  width,
  color,
}: {
  text: string;
  fontSize: number;
  lines: number;
  width: number;
  color: string;
}) {
  const pieces = reviewPieces(text.trim());
  const lineHeight = fontSize * 1.5;
  const maxHeight = lines * lineHeight;

  if (pieces.every((piece) => "text" in piece)) {
    return (
      <div
        style={{
          display: "block",
          fontSize,
          lineHeight: 1.5,
          lineClamp: lines,
          whiteSpace: "pre-wrap",
        }}
      >
        {pieces.map((piece) => ("text" in piece ? piece.text : "")).join("")}
      </div>
    );
  }

  const rows = layOut(pieces, (tex, display) =>
    texPicture(tex, {
      display,
      color,
      em: fontSize * MATH_SIZE,
      maxWidth: width,
      maxHeight,
    }),
  );
  const baseline = BASELINE * fontSize;

  return (
    // Cut off by height, fading out over its last line, as the site's cards do
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        maxHeight,
        overflow: "hidden",
        fontSize,
        lineHeight: 1.5,
        maskImage: `linear-gradient(to bottom, #000 ${maxHeight - lineHeight}px, transparent ${maxHeight}px)`,
      }}
    >
      {rows.map((row, i) => {
        if ("display" in row) {
          const math = row.display;
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: rows never move
              key={i}
              style={{
                display: "flex",
                flexShrink: 0,
                justifyContent: "center",
                margin: `${fontSize}px 0`,
              }}
            >
              <MathPicture math={math} />
            </div>
          );
        }
        // Each line's words sit on one baseline: words keep their depth
        // below it, and the paragraph's deepest math sets how much that is
        const depth = Math.max(
          baseline,
          ...row.words.map((word) => ("src" in word ? word.depth : 0)),
        );
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: rows never move
            key={i}
            style={{
              display: "flex",
              flexShrink: 0,
              flexWrap: "wrap",
              alignItems: "flex-end",
              minHeight: lineHeight,
            }}
          >
            {row.words.map((word, j) =>
              "src" in word ? (
                <MathPicture
                  // biome-ignore lint/suspicious/noArrayIndexKey: words never move
                  key={j}
                  math={word}
                  below={depth - word.depth}
                />
              ) : (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: words never move
                  key={j}
                  style={{
                    whiteSpace: "pre",
                    color: word.color,
                    paddingBottom: depth - baseline,
                  }}
                >
                  {word.text}
                </span>
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}

function MathPicture({ math, below = 0 }: { math: MathBox; below?: number }) {
  return (
    // biome-ignore lint/performance/noImgElement: drawn into a PNG, not shown on a page
    <img
      src={math.src}
      alt=""
      width={math.width}
      height={math.height}
      style={{ flexShrink: 0, marginBottom: below }}
    />
  );
}

// The pieces of a review as rows: paragraphs of words and math, which start
// at each line break, and math on its own line. TeX that can't be drawn
// shows as written, in red.
function layOut(
  pieces: ReviewPiece[],
  draw: (tex: string, display: boolean) => MathBox | null,
): Row[] {
  const rows: Row[] = [];
  let words: (Word | MathBox)[] = [];
  const addWords = (text: string, color?: string) => {
    text.split("\n").forEach((line, i) => {
      if (i > 0) {
        rows.push({ words });
        words = [];
      }
      // Each word keeps the spaces after it, so lines break between words
      for (const word of line.match(/\S*\s*/g) ?? []) {
        if (word) words.push({ text: word, color });
      }
    });
  };

  for (const piece of pieces) {
    if ("text" in piece) {
      addWords(piece.text);
      continue;
    }
    const math = draw(piece.tex, piece.display);
    if (!math) {
      addWords(piece.tex, ERROR_COLOR);
    } else if (piece.display) {
      if (words.length > 0) rows.push({ words });
      words = [];
      rows.push({ display: math });
    } else {
      words.push(math);
    }
  }
  if (words.length > 0) rows.push({ words });
  return rows;
}
