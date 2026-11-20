import { useTranslations } from "next-intl";

const BUTTON =
  "inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-md px-2 text-[0.95rem] hover:bg-background";

// The buttons along the bottom of a review box: bold, italic, and a link to a
// web page. Pressing one leaves the box focused, with its text still selected.
export default function FormatBar({
  onBold,
  onItalic,
  onLink,
}: {
  onBold: () => void;
  onItalic: () => void;
  onLink: () => void;
}) {
  const t = useTranslations();
  // Keeps the focus (and the selection) in the box
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="flex items-center gap-0.5 border border-t-0 border-line bg-surface px-1 py-0.5">
      <button
        type="button"
        onMouseDown={keepFocus}
        onClick={onBold}
        aria-label={t("logs.format.bold")}
        title={t("logs.format.bold")}
        className={`${BUTTON} font-bold`}
      >
        B
      </button>
      <button
        type="button"
        onMouseDown={keepFocus}
        onClick={onItalic}
        aria-label={t("logs.format.italic")}
        title={t("logs.format.italic")}
        className={`${BUTTON} italic`}
      >
        I
      </button>
      <button
        type="button"
        onMouseDown={keepFocus}
        onClick={onLink}
        title={t("logs.format.linkTitle")}
        className={BUTTON}
      >
        <svg
          aria-hidden
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
        </svg>
        <span className="text-sm">{t("logs.format.link")}</span>
      </button>
      <span className="ml-auto hidden pr-2 text-xs text-muted sm:inline">
        {t("logs.format.itemHint")}
      </span>
    </div>
  );
}
