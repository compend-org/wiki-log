export default function HeartIcon({
  filled = false,
  className = "",
}: {
  filled?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 20.5C5 15.5 3 12 3 8.9 3 6.2 5.1 4.3 7.5 4.3c1.7 0 3.4.9 4.5 2.5 1.1-1.6 2.8-2.5 4.5-2.5 2.4 0 4.5 1.9 4.5 4.6 0 3.1-2 6.6-9 11.6z" />
    </svg>
  );
}