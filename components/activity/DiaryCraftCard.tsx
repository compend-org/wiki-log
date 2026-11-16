// ABOUTME: A compound you crafted, in your diary: its picture, name and what it was made from.
// ABOUTME: The whole card opens the compound's page; buttons edit or delete it.
"use client";

import Link from "next/link";
import { useState } from "react";
import CompoundDeleteButton from "@/components/craft/CompoundDeleteButton";
import CompoundEditButton from "@/components/craft/CompoundEditButton";
import ItemImage from "@/components/items/ItemImage";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";

export default function DiaryCraftCard({
  itemId,
  title,
  description,
  imageUrl,
  nsfw,
  parts,
  ago,
  owner,
}: {
  itemId: string;
  title: string;
  description: string;
  imageUrl: string | null;
  nsfw: boolean;
  // The names of what it was made from, in order
  parts: string[];
  // When it was crafted, as shown: "5m ago", or the date once it's a day old
  ago: string;
  owner?: string;
}) {
  const [deleted, setDeleted] = useState<boolean>(false);
  // A saved edit shows straight away, until the server sends a different one
  const [shownTitle, setShownTitle] = useLocalCopy(title);
  const [shownDescription, setShownDescription] = useLocalCopy(description);
  const [shownImage, setShownImage] = useLocalCopy(imageUrl);

  if (deleted) return null;

  return (
    <div className="card relative flex gap-3 p-3 hover-or-tap:border-accent/60">
      {/* The whole card opens the compound, except the links above it */}
      <Link
        href={`/item/${itemId}`}
        aria-label={`Open ${shownTitle}`}
        className="card-link absolute inset-0 rounded-[inherit]"
      />
      <ItemImage
        src={shownImage}
        alt={shownTitle}
        nsfw={nsfw}
        className="h-14 w-14 shrink-0 rounded"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-3 text-xs text-muted">
          <span>
            {ago} · {owner ?? "You"} crafted a compound
          </span>
          {!owner && (
            <span className="flex items-center gap-3">
              <CompoundEditButton
                id={itemId}
                title={shownTitle}
                description={shownDescription}
                imageUrl={shownImage}
                onSaved={(d) => {
                  setShownTitle(d.title);
                  setShownDescription(d.description);
                  setShownImage(d.imageUrl);
                }}
              />
              <CompoundDeleteButton
                id={itemId}
                cardKey={`craft:${itemId}`}
                onDeleted={() => setDeleted(true)}
              />
            </span>
          )}
        </div>
        <Link
          href={`/item/${itemId}`}
          className="card-link relative z-10 w-fit font-semibold hover:underline"
        >
          {shownTitle}
        </Link>
        {parts.length > 0 && (
          <span className="line-clamp-2 text-xs text-muted">
            {parts.join(" + ")}
          </span>
        )}
      </div>
    </div>
  );
}
