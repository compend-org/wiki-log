// ABOUTME: Decides from OpenAI moderation scores whether a post's images should get it removed.
// ABOUTME: Only categories OpenAI scores for images count; the rest always read 0 for them.

// OpenAI's score for each category, from 0 to 1
export type CategoryScores = Record<string, number>;

// The score at or above which a category gets a post with images removed.
// OpenAI's own "flagged" is stricter than we want: an ordinary photo of a cut
// leg scores 0.61 for violence and it flags that.
const IMAGE_THRESHOLDS: Record<string, number> = {
  sexual: 0.5,
  violence: 0.8,
  "violence/graphic": 0.5,
  "self-harm": 0.5,
  "self-harm/intent": 0.5,
  "self-harm/instructions": 0.5,
};

// OpenAI only looks at a GIF's first frame, so this many frames of each GIF
// are checked as separate images
const GIF_FRAMES_CHECKED = 4;

// Which frames of a GIF with `frameCount` frames to check: spread evenly from
// the first to the last
export function framesToCheck(frameCount: number): number[] {
  const count = Math.min(Math.max(frameCount, 1), GIF_FRAMES_CHECKED);
  if (count === 1) return [0];
  return Array.from({ length: count }, (_, i) =>
    Math.round((i * (frameCount - 1)) / (count - 1)),
  );
}

export type ImageVerdict = {
  // Every category's highest score across all the images and frames checked
  maxScores: CategoryScores;
  // The categories at or above their threshold, highest score first
  over: string[];
  // The report reason when anything is over: sexual content, or anything else
  reason: "sexual" | "other" | null;
};

export function imageVerdict(scores: CategoryScores[]): ImageVerdict {
  const maxScores: CategoryScores = {};
  for (const image of scores) {
    for (const [category, score] of Object.entries(image)) {
      maxScores[category] = Math.max(maxScores[category] ?? 0, score);
    }
  }

  const over = Object.keys(IMAGE_THRESHOLDS)
    .filter((c) => (maxScores[c] ?? 0) >= IMAGE_THRESHOLDS[c])
    .sort((a, b) => maxScores[b] - maxScores[a]);

  const reason =
    over.length === 0 ? null : over.includes("sexual") ? "sexual" : "other";
  return { maxScores, over, reason };
}

// The report's details, which moderators read on the reports page
export function verdictDetails(verdict: ImageVerdict): string {
  const scores = verdict.over
    .map((c) => `${c} ${verdict.maxScores[c].toFixed(2)}`)
    .join(", ");
  return `Removed by the automatic image check: ${scores}`;
}
