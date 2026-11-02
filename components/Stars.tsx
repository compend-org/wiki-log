export default function Stars({
  rating,
  className = "",
  track = false,
}: {
  rating: number;
  className?: string;
  // Draws all five stars with the unearned ones dim. Only the rating input
  // needs this, so there's something to point at.
  track?: boolean;
}) {
  const clamped = Math.max(0, Math.min(5, rating));

  if (track) {
    const fraction = clamped / 5;
    return (
      <span
        role="img"
        aria-label={`${rating} out of 5 stars`}
        className={`relative inline-block w-fit leading-none tracking-[0.05em] ${className}`}
      >
        <span className="text-muted/60" aria-hidden="true">
          ★★★★★
        </span>
        <span
          aria-hidden="true"
          className="absolute inset-0 whitespace-nowrap text-star"
          style={{
            clipPath: `inset(-0.5em ${(1 - fraction) * 100}% -0.5em -0.5em)`,
          }}
        >
          ★★★★★
        </span>
      </span>
    );
  }

  const full = Math.floor(clamped);
  const half = clamped - full >= 0.5;

  return (
    <span
      role="img"
      aria-label={`${rating} out of 5 stars`}
      className={`inline-flex w-fit items-center leading-none text-star ${className}`}
    >
      {Array.from({ length: full }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="inline-block w-[1.1em] text-center"
        >
          ★
        </span>
      ))}
      {half && (
        // The left half of one more star: a box half as wide, with the rest cut off
        <span aria-hidden="true" className="w-[0.55em] overflow-x-clip">
          <span className="inline-block w-[1.1em] text-center">★</span>
        </span>
      )}
    </span>
  );
}