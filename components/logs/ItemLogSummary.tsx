// ABOUTME: Shows an item's entry count and average rating below ten ratings.
// ABOUTME: Keeps stable element boundaries around text browser translation may replace.
import { useTranslations } from "next-intl";

export default function ItemLogSummary({
  people,
  average,
  logCount,
}: {
  people: number;
  average: number;
  logCount: number;
}) {
  const t = useTranslations();
  if (people >= 10) return null;

  return (
    <p className="text-muted">
      {/* Keep element boundaries around text that translation may replace.
          Adding/removing the average must not target a detached text node. */}
      {people > 0 && (
        <span>
          <span className="text-star">★</span>
          <span>{` ${t("item.averageFrom", { average: average.toFixed(1), people })} · `}</span>
        </span>
      )}
      <span>{t("counts.entries", { count: logCount })}</span>
    </p>
  );
}
