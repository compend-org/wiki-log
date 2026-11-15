// ABOUTME: Shows an item's entry count and average rating below ten ratings.
// ABOUTME: Keeps stable element boundaries around text browser translation may replace.
export default function ItemLogSummary({
  people,
  average,
  logCount,
}: {
  people: number;
  average: number;
  logCount: number;
}) {
  if (people >= 10) return null;

  return (
    <p className="text-muted">
      {/* Keep element boundaries around text that translation may replace.
          Adding/removing the average must not target a detached text node. */}
      {people > 0 && (
        <span>
          <span className="text-star">★</span>
          <span>{` ${average.toFixed(1)} average from ${people} ${people === 1 ? "person" : "people"} · `}</span>
        </span>
      )}
      <span>{`${logCount} ${logCount === 1 ? "entry" : "entries"}`}</span>
    </p>
  );
}
