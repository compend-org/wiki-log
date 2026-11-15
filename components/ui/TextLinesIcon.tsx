// ABOUTME: Three lines of text, marking something that has written words.
// ABOUTME: Used on avatars of reviews that have a review body.
export default function TextLinesIcon({
  className = "",
  size = 12,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M5 7h14M5 12h14M5 17h9" />
    </svg>
  );
}
