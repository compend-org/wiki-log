export default function EditIcon({ className }: { className?: string }) {
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
            {/* Scaled to 60% to fill the same 12 units as the delete cross. The
          stroke is widened to make up for the scaling. */}
            <g transform="translate(2.4 2.4) scale(0.8)" strokeWidth="2">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
            </g>
        </svg>
    );
}