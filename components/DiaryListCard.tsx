// ABOUTME: One of your lists in your diary, with a few of its pictures and links to edit or delete it.
// ABOUTME: Shows what the server sent, and hides itself once deleted here.
"use client";

import Link from "next/link";
import { useState } from "react";
import DeleteButton from "@/components/buttons/DeleteButton";
import EditIcon from "@/components/icons/EditIcon";
import ItemImage from "@/components/icons/ItemImage";

type ListPreview = { title: string; imageUrl: string | null; nsfw: boolean };

export default function DiaryListCard({
  listId,
  title,
  ranked,
  count,
  previews,
  ago,
}: {
  listId: string;
  title: string;
  ranked: boolean;
  // How many items the list holds
  count: number;
  // The first few of them
  previews: ListPreview[];
  // When it was made, as shown: "5m ago", or the date once it's a day old
  ago: string;
}) {
  const [deleted, setDeleted] = useState<boolean>(false);

  if (deleted) return null;

  return (
    <div className="card relative flex flex-col gap-2 p-3 hover-or-tap:border-accent/60">
      {/* The whole card opens the list, except the links above it */}
      <Link
        href={`/list/${listId}`}
        aria-label={`Open ${title}`}
        className="absolute inset-0 rounded-[inherit]"
      />
      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <span>
          {ago} · You made a {ranked ? "ranked " : ""}list
        </span>
        <span className="flex items-center gap-3">
          <Link
            href={`/list/${listId}/edit`}
            aria-label="Edit this list"
            title="Edit this list"
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
      </div>
      <Link
        href={`/list/${listId}`}
        className="relative z-10 w-fit font-semibold underline"
      >
        {title}
      </Link>
      {previews.length > 0 && (
        <div className="flex gap-1">
          {previews.map((p, i) => (
            <ItemImage
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed-order list whose entries can repeat
              key={i}
              src={p.imageUrl}
              nsfw={p.nsfw}
              alt={p.title}
              className="h-14 w-14 rounded"
            />
          ))}
        </div>
      )}
      <span className="text-xs text-muted">
        {count} {count === 1 ? "item" : "items"}
      </span>
    </div>
  );
}
