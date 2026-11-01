export default function Stars({
  rating,
  className = "",
}: {
  rating: number;
  className?: string;
}) {
  const fraction = Math.max(0, Math.min(5, rating)) / 5;

  return (
    <span
      role="img"
      aria-label={`${rating} out of 5 stars`}
      className={`relative inline-block leading-none tracking-[0.05em] ${className}`}
    >
      <span className="text-muted/60" aria-hidden="true">
        ★★★★★
      </span>
      <span
        aria-hidden="true"
        className="stars absolute inset-0 whitespace-nowrap text-accent"
        style={{
          // Clip the right side; the negative insets keep the glow from being cut off
          clipPath: `inset(-0.5em ${(1 - fraction) * 100}% -0.5em -0.5em)`,
        }}
      >
        ★★★★★
      </span>
    </span>
  );
}