// ABOUTME: One of your lists in your diary, with a few of its pictures and links to edit or delete it.
// ABOUTME: Shows what the server sent, and hides itself once deleted here.
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import ListPreview from "@/components/lists/ListPreview";
import DeleteButton from "@/components/logs/DeleteButton";
import EditIcon from "@/components/ui/EditIcon";
import type { GroupPreview } from "@/lib/lists/groupPreview";
import { itemsLabel } from "@/lib/lists/listGroups";

type PreviewItem = {
  title: string;
  imageUrl: string | null;
  nsfw: boolean;
};

export default function DiaryListCard({
  listId,
  title,
  ranked,
  groups = null,
  groupPreviews = null,
  count,
  previews,
  ago,
  author,
  owner,
}: {
  listId: string;
  title: string;
  ranked: boolean;
  // How many groups a grouped list has; null for a plain list
  groups?: number | null;
  // A grouped list's groups, each with its first few items
  groupPreviews?: GroupPreview[] | null;
  // How many items the list holds
  count: number;
  // The first few of them
  previews: PreviewItem[];
  // When it was made, as shown: "5m ago", or the date once it's a day old
  ago: string;
  author?: string;
  owner?: string;
}) {
  const t = useTranslations();
  const who = owner ?? "You";
  const kind = groups !== null ? "grouped " : ranked ? "ranked " : "";
  const [deleted, setDeleted] = useState<boolean>(false);

  if (deleted) return null;

  return (
    <div className="card relative flex flex-col gap-2 p-3 hover-or-tap:border-accent/60">
      {/* The whole card opens the list, except the links above it */}
      <Link
        href={`/list/${listId}`}
        aria-label={`Open ${title}`}
        className="card-link absolute inset-0 rounded-[inherit]"
      />
      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <span>
          {ago} ·{" "}
          {author
            ? `${who} liked ${author}'s ${kind}list`
            : `${who} made a ${kind}list`}
        </span>
        {!author && !owner && (
          <span className="flex items-center gap-3">
            <Link
              href={`/list/${listId}/edit`}
              aria-label={t("lists.editThisList")}
              title={t("lists.editThisList")}
              className="relative z-10 flex text-accent hover:text-foreground hover:opacity-70 hover:no-underline"
            >
              <EditIcon className="h-4 w-4" />
            </Link>
            <DeleteButton
              kind="list"
              targetId={listId}
              onDeleted={() => setDeleted(true)}
            />
          </span>
        )}
      </div>
      <Link
        href={`/list/${listId}`}
        className="card-link relative z-10 w-fit block max-w-full min-w-0 line-clamp-2 [overflow-wrap:anywhere] font-semibold hover:underline"
      >
        {title}
      </Link>
      {(groupPreviews || previews.length > 0) && (
        <ListPreview
          thumbs={previews.map((p) => ({
            title: p.title,
            image_url: p.imageUrl,
            nsfw: p.nsfw,
          }))}
          total={count}
          groups={groupPreviews}
          href={`/list/${listId}`}
        />
      )}
      <span className="text-xs text-muted">{itemsLabel(count, groups)}</span>
    </div>
  );
}
