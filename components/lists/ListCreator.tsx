"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import GroupedListEditor from "@/components/lists/GroupedListEditor";
import ListEditor from "@/components/lists/ListEditor";
import { emptyGroup, type GroupEntry } from "@/lib/lists/listGroups";

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
  // Made once, so the group keeps its key while the page is open
  const [firstGroups] = useState(() => [
    { ...emptyGroup(), items: firstItem ? [firstItem] : [] },
  ]);

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
                onChange={() => setKind(k)}
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
          list={{ id: null, title: "", description: null, ranked: false }}
          ownerName=""
          initialItems={firstItem ? [{ ...firstItem, note: null }] : []}
        />
      ) : (
        <GroupedListEditor
          key={kind}
          list={{
            id: null,
            title: "",
            description: null,
            labeled: true,
          }}
          ownerName=""
          initialGroups={firstItem ? firstGroups : []}
        />
      )}
    </div>
  );
}
