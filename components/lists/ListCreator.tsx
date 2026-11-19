"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState } from "react";
import GroupedListEditor from "@/components/lists/GroupedListEditor";
import ListEditor from "@/components/lists/ListEditor";
import {
  type CreatorDraft,
  EMPTY_DRAFT,
  groupsFromDraft,
} from "@/lib/lists/creatorDraft";
import type { GroupEntry } from "@/lib/lists/listGroups";

type Kind = "plain" | "grouped";

const KINDS: Kind[] = ["plain", "grouped"];

// The new-list page when grouped lists are on: pick the kind of list, then
// fill it in
export default function ListCreator({
  firstItem,
}: {
  // The item the list starts with, when it is made from an item's page
  firstItem: GroupEntry | null;
}) {
  const t = useTranslations();
  const labelOf = (k: Kind) => t(`lists.creator.${k}Label`);
  const hintOf = (k: Kind) => t(`lists.creator.${k}Hint`);
  const [kind, setKind] = useState<Kind>("plain");
  // What the list holds when the editor for the current kind was opened: the
  // item it starts with, or what the other kind of list held
  const [seed, setSeed] = useState<CreatorDraft>(() => ({
    ...EMPTY_DRAFT,
    items: firstItem ? [{ ...firstItem, note: firstItem.note ?? null }] : [],
  }));
  // What the open editor holds now. Kept in a ref: nothing here shows it.
  const latest = useRef<CreatorDraft | null>(null);
  const onDraft = useCallback((draft: CreatorDraft) => {
    latest.current = draft;
  }, []);
  // Made once per seed, so a group keeps its key while the editor is open
  const seedGroups = useMemo(() => groupsFromDraft(seed), [seed]);

  // The title, description, items and their notes and pictures go with the
  // list to the other kind
  function chooseKind(next: Kind) {
    if (latest.current) setSeed(latest.current);
    setKind(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
          {t("lists.creator.kindLegend")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <label
              key={k}
              title={hintOf(k)}
              className={`cursor-pointer rounded-lg border px-4 py-2 text-sm ${
                kind === k
                  ? "border-accent text-accent"
                  : "border-line text-foreground"
              }`}
            >
              <input
                type="radio"
                name="list-kind"
                value={k}
                checked={kind === k}
                onChange={() => chooseKind(k)}
                className="sr-only"
              />
              {labelOf(k)}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">
          {t("lists.creator.cannotChange", { hint: hintOf(kind) })}
        </p>
      </fieldset>

      {kind === "plain" ? (
        <ListEditor
          key={kind}
          list={{
            id: null,
            title: seed.title,
            description: seed.description || null,
            ranked: false,
          }}
          ownerName=""
          initialItems={seed.items}
          initialPictures={seed.pictures}
          onDraft={onDraft}
        />
      ) : (
        <GroupedListEditor
          key={kind}
          list={{
            id: null,
            title: seed.title,
            description: seed.description || null,
            labeled: true,
          }}
          ownerName=""
          initialGroups={seedGroups}
          initialPictures={seed.pictures}
          onDraft={onDraft}
        />
      )}
    </div>
  );
}
