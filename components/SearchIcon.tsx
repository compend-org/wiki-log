export default function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {/* the person */}
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6.2 6.5-6.2 1.2 0 2.3.3 3.2.8" />
      {/* the magnifying glass */}
      <circle cx="17" cy="16.5" r="3" />
      <path d="M19.2 18.7L22 21.5" />
    </svg>
  );
}
