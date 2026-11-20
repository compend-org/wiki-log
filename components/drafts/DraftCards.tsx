// ABOUTME: Cards for the drafts page: a log entry being written and a list being made.
// ABOUTME: Each opens its draft to carry on with it, and has a cross that deletes it after asking.
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { deleteListDraft, deleteLogDraft } from "@/app/draftActions";
import DeleteDraftButton from "@/components/drafts/DeleteDraftButton";
import ItemImage from "@/components/items/ItemImage";
import ListPreview from "@/components/lists/ListPreview";
import Stars from "@/components/logs/Stars";
import DeleteIcon from "@/components/ui/DeleteIcon";
import { track } from "@/lib/analytics/analytics";
import { plainReview, timeAgo } from "@/lib/format";

export type LogDraftSummary = {
  item_id: string;
  title: string;
  image_url: string | null;
  nsfw: boolean;
  rating: number | null;
  review: string;
  saved_at: string;
};

export type ListDraftSummary = {
  id: string;
  grouped: boolean;
  ranked: boolean;
  title: string;
  saved_at: string;
  item_count: number;
  // The first few items
  thumbs: { title: string; image_url: string | null; nsfw: boolean }[];
};

// The cross in a card's corner, which refreshes the page once the draft is gone
function DeleteCorner({
  kind,
  onDelete,
}: {
  kind: "log" | "list";
  onDelete: () => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  return (
    <span className="relative z-10 flex">
      <DeleteDraftButton
        onDelete={async () => {
          const result = await onDelete();
          if (!result.error) {
            track("draft_deleted", { kind, from: "drafts_page" });
            router.refresh();
          }
          return result;
        }}
        className="flex text-danger hover:opacity-70"
      >
        <DeleteIcon className="h-4 w-4" />
      </DeleteDraftButton>
    </span>
  );
}

export function LogDraftCard({
  draft: d,
  now,
}: {
  draft: LogDraftSummary;
  // When the page was made, for how long ago the draft was saved
  now: number;
}) {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <div className="card relative flex gap-3 p-3 hover-or-tap:border-accent/60">
      <Link
        href={`/item/${d.item_id}#log`}
        aria-label={t("drafts.openLog", { title: d.title })}
        className="card-link absolute inset-0 rounded-[inherit]"
      />
      <ItemImage
        src={d.image_url}
        alt={d.title}
        nsfw={d.nsfw}
        sourceWidth={160}
        className="aspect-square w-20 shrink-0"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm text-muted">
            {t("drafts.savedAgo", {
              ago: timeAgo(d.saved_at, now, t, locale),
            })}
          </span>
          <DeleteCorner
            kind="log"
            onDelete={() =>
              deleteLogDraft({ itemId: d.item_id, savedAt: d.saved_at })
            }
          />
        </div>
        <span className="font-semibold [overflow-wrap:anywhere]">
          {d.title}
        </span>
        {d.rating ? (
          <Stars rating={Number(d.rating)} />
        ) : (
          <span className="text-sm text-muted">{t("drafts.noRatingYet")}</span>
        )}
        {d.review.trim() && (
          <p className="line-clamp-3 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
            {plainReview(d.review)}
          </p>
        )}
      </div>
    </div>
  );
}

export function ListDraftCard({
  draft: d,
  now,
}: {
  draft: ListDraftSummary;
  // When the page was made, for how long ago the draft was saved
  now: number;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const href = `/list/new?draft=${d.id}`;
  const title = d.title.trim() || t("drafts.untitledList");
  return (
    <div className="card relative flex flex-col gap-2 p-3 hover-or-tap:border-accent/60">
      <Link
        href={href}
        aria-label={t("drafts.openList", { title })}
        className="card-link absolute inset-0 rounded-[inherit]"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted">
          {t("drafts.listMeta", {
            kind: d.grouped ? "grouped" : d.ranked ? "ranked" : "plain",
            ago: timeAgo(d.saved_at, now, t, locale),
          })}
        </span>
        <DeleteCorner
          kind="list"
          onDelete={() => deleteListDraft({ id: d.id, savedAt: d.saved_at })}
        />
      </div>
      <span className="min-w-0 line-clamp-2 [overflow-wrap:anywhere] font-semibold">
        {title}
      </span>
      {d.thumbs.length > 0 && (
        <ListPreview thumbs={d.thumbs} total={d.item_count} href={href} />
      )}
      <span className="text-sm text-muted">
        {d.item_count === 0
          ? t("drafts.noItemsYet")
          : t("counts.items", { count: d.item_count })}
      </span>
    </div>
  );
}
