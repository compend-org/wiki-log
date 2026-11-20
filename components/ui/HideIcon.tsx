// ABOUTME: A crossed-out eye, drawn in the current text colour.
// ABOUTME: Marks hiding an item, and the tile that covers a hidden item's picture.
export default function HideIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c5 0 8.6 4.1 9.7 6.2a1.7 1.7 0 0 1 0 1.6 15 15 0 0 1-2.6 3.4" />
      <path d="M6.6 6.6A15.3 15.3 0 0 0 2.3 11.2a1.7 1.7 0 0 0 0 1.6C3.4 14.9 7 19 12 19a9.9 9.9 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
