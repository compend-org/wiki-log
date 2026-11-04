// How everyone rated one item: a bar for each half-star from 0.5 to 5, with
// the viewer's own rating picked out in the star colour.
const STEPS = Array.from({ length: 10 }, (_, i) => (i + 1) / 2);

export default function RatingHistogram({
  ratings,
  highlight,
}: {
  // One rating per person
  ratings: number[];
  // The viewer's own rating of this item, if they have one
  highlight: number | null;
}) {
  if (ratings.length < 10) return null;

  const counts = STEPS.map(
    (step) => ratings.filter((r) => Math.round(r * 2) / 2 === step).length,
  );
  const tallest = Math.max(...counts, 1);
  const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  const people = ratings.length;

  return (
    <section
      aria-label={`Ratings: ${average.toFixed(1)} average from ${people} ${
        people === 1 ? "person" : "people"
      }`}
      className="card flex flex-col gap-2 p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Ratings
        </h2>
        <p className="text-sm text-muted">
          <span className="text-star">★</span> {average.toFixed(1)} average ·{" "}
          {people} {people === 1 ? "person" : "people"}
        </p>
      </div>

      <div className="flex h-20 items-end gap-1" aria-hidden="true">
        {STEPS.map((step, i) => {
          const picked =
            highlight !== null && Math.round(highlight * 2) / 2 === step;
          const count = counts[i];
          return (
            <div
              key={step}
              title={`${step} ★: ${count} ${count === 1 ? "person" : "people"}`}
              className="flex h-full flex-1 items-end"
            >
              <div
                className={`w-full rounded-sm ${
                  picked ? "bg-star" : count > 0 ? "bg-muted/50" : "bg-line/60"
                }`}
                style={{
                  height:
                    count > 0
                      ? `${Math.max(8, (count / tallest) * 100)}%`
                      : "2px",
                }}
              />
            </div>
          );
        })}
      </div>

      <div
        className="flex justify-between text-xs leading-none text-muted"
        aria-hidden="true"
      >
        {/* <span>★</span>
        {highlight !== null && (
          <span>
            <span className="text-star">■</span> Your rating
          </span>
        )}
        <span>★★★★★</span> */}
      </div>
    </section>
  );
}
