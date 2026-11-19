// Five equal cells with a star centred in each, so a fraction of the width is
// the same fraction of the stars at any size. Wide (phone) rows scale the stars
// with the row.
function StarCells({
  className,
  style,
}: {
  className: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex whitespace-nowrap max-sm:text-[min(14cqw,3.5rem)] ${className}`}
      style={style}
    >
      {[0, 1, 2, 3, 4].map((n) => (
        <span key={n} className="w-[1.15em] text-center max-sm:flex-1">
          ★
        </span>
      ))}
    </span>
  );
}

export default function Stars({
  rating,
  className = "",
  track = false,
}: {
  rating: number | null | undefined;
  className?: string;
  // Draws all five stars with the unearned ones dim. Only the rating input
  // needs this, so there's something to point at.
  track?: boolean;
}) {
  const value = rating ?? 0;
  const clamped = Math.max(0, Math.min(5, value));
  const label = value > 0 ? `${value} out of 5 stars` : "No rating";

  if (track) {
    const fraction = clamped / 5;
    return (
      <span
        role="img"
        aria-label={label}
        className={`relative inline-block w-fit leading-none ${className}`}
      >
        <StarCells className="text-muted/60" />
        <StarCells
          className="absolute inset-0 text-star"
          style={{
            clipPath: `inset(-0.5em ${(1 - fraction) * 100}% -0.5em -0.5em)`,
          }}
        />
      </span>
    );
  }

  // No rating: show nothing
  if (clamped <= 0) return null;

  const full = Math.floor(clamped);
  const half = clamped - full >= 0.5;

  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-flex w-fit items-center leading-none text-star ${className}`}
    >
      {Array.from({ length: full }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed-order list whose entries can repeat
          key={i}
          aria-hidden="true"
          className="inline-block w-[1.1em] text-center"
        >
          ★
        </span>
      ))}
      {half && (
        <span aria-hidden="true" className="w-[0.55em] overflow-x-clip">
          <span className="inline-block w-[1.1em] text-center">★</span>
        </span>
      )}
    </span>
  );
}
