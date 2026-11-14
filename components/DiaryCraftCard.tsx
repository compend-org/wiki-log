// ABOUTME: A compound you crafted, in your diary: its picture, name and what it was made from.
// ABOUTME: The whole card opens the compound's page; buttons edit or delete it.
"use client";

import Link from "next/link";
import { useState } from "react";
import CompoundDeleteButton from "@/components/buttons/CompoundDeleteButton";
import CompoundEditButton from "@/components/buttons/CompoundEditButton";
import ItemImage from "@/components/icons/ItemImage";
import { useLocalCopy } from "@/lib/useLocalCopy";

export default function DiaryCraftCard({
  itemId,
  title,
  description,
  imageUrl,
  parts,
  ago,
}: {
  itemId: string;
  title: string;
  description: string;
  imageUrl: string | null;
  // The names of what it was made from, in order
  parts: string[];
  // When it was crafted, as shown: "5m ago", or the date once it's a day old
  ago: string;
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
        className="absolute inset-0 rounded-[inherit]"
      />
      <ItemImage
        src={shownImage}
        alt={shownTitle}
        className="h-14 w-14 shrink-0 rounded"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-3 text-xs text-muted">
          <span>{ago} · You crafted a compound</span>
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
        </div>
        <Link
          href={`/item/${itemId}`}
          className="relative z-10 w-fit font-semibold hover:underline"
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
