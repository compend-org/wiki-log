export default function ItemImage({
  src,
  alt,
  className = "",
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        aria-hidden="true"
        className={`flex items-center justify-center bg-surface text-muted ${className}`}
      >
        <span className="font-[family-name:var(--font-display-src)] text-2xl uppercase">
          {alt.charAt(0)}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={`object-cover ${className}`} />
  );
}