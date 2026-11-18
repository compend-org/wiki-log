// ABOUTME: A framed landscape, the icon of buttons that change a picture, in the current text colour.
// ABOUTME: Drawn on the same 24-unit grid as the site's other icons.
export default function PictureIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m3 18 5-5 4 4 3-3 6 6" />
    </svg>
  );
}
