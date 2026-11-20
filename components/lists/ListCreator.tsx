// ABOUTME: The new-list page's form: picks the kind of list, then fills it in, keeping it as a draft.
// ABOUTME: The draft stays the same while switching kinds, and the address names it once it's saved.
"use client";

import { useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ListDraftSession } from "@/components/drafts/useListDraft";
import GroupedListEditor from "@/components/lists/GroupedListEditor";
import ListEditor from "@/components/lists/ListEditor";
import { FEATURES } from "@/lib/features";
import {
  type CreatorDraft,
  EMPTY_DRAFT,
  groupsFromDraft,
} from "@/lib/lists/creatorDraft";
import type { OpenedListDraft } from "@/lib/lists/listDrafts";
import { emptyGroup, type GroupEntry } from "@/lib/lists/listGroups";

type Kind = "plain" | "grouped";

const KINDS: Kind[] = ["plain", "grouped"];

// What an opened draft starts the editors with
function seedFrom(draft: OpenedListDraft): CreatorDraft {
  return {
    title: draft.title,
    description: draft.description,
    items: draft.groups.flatMap((g) => g.items),
    pictures: draft.pictures,
  };
}

export default function ListCreator({
  firstItem,
  draft,
}: {
  // The item the list starts with, when it is made from an item's page
  firstItem: GroupEntry | null;
  // The saved draft the page opened, if any
  draft: OpenedListDraft | null;
}) {
  const t = useTranslations();
  const labelOf = (k: Kind) => t(`lists.creator.${k}Label`);
  const hintOf = (k: Kind) => t(`lists.creator.${k}Hint`);
  const [kind, setKind] = useState<Kind>(draft?.grouped ? "grouped" : "plain");
  // What the list holds when the editor for the current kind was opened: the
  // draft or item it starts with, or what the other kind of list held
  const [seed, setSeed] = useState<CreatorDraft>(() =>
    draft
      ? seedFrom(draft)
      : {
          ...EMPTY_DRAFT,
          items: firstItem
            ? [{ ...firstItem, note: firstItem.note ?? null }]
            : [],
        },
  );
  // The draft opened with the page, until it's deleted. Its kind is fixed.
  const [opened, setOpened] = useState<OpenedListDraft | null>(draft);
  // The form's saved draft, whose ID is picked before its first save
  const [draftId, setDraftId] = useState<string>(
    () => draft?.id ?? crypto.randomUUID(),
  );
  const [savedAt, setSavedAt] = useState<string | null>(draft?.savedAt ?? null);
  // Goes up each time the form starts over empty
  const [round, setRound] = useState<number>(0);
  // What the open editor holds now. Kept in a ref: nothing here shows it.
  const latest = useRef<CreatorDraft | null>(null);
  const onDraft = useCallback((current: CreatorDraft) => {
    latest.current = current;
  }, []);
  // Made once per seed, so a group keeps its key while the editor is open.
  // An opened grouped draft keeps its groups.
  const seedGroups = useMemo(
    () =>
      opened?.grouped
        ? opened.groups.map((g) => ({ ...emptyGroup(g.name), items: g.items }))
        : groupsFromDraft(seed),
    [opened, seed],
  );

  // The title, description, items and their notes and pictures go with the
  // list to the other kind
  function chooseKind(next: Kind) {
    if (latest.current) setSeed(latest.current);
    setKind(next);
  }

  const savedDraft: ListDraftSession = {
    id: draftId,
    savedAt,
    resumed: opened !== null,
    onSaved: (at) => {
      setSavedAt(at);
      // Reloading the page comes back to the draft
      const address = `/list/new?draft=${draftId}`;
      if (window.location.pathname + window.location.search !== address) {
        window.history.replaceState(null, "", address);
      }
    },
    onDeleted: () => {
      setOpened(null);
      setSeed(EMPTY_DRAFT);
      latest.current = null;
      setDraftId(crypto.randomUUID());
      setSavedAt(null);
      setRound(round + 1);
      window.history.replaceState(null, "", "/list/new");
    },
  };
  const editorKey = `${kind}:${round}`;

  return (
    <div className="flex flex-col gap-6">
      {FEATURES.groupedLists && !opened && (
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
      )}

      {kind === "plain" ? (
        <ListEditor
          key={editorKey}
          list={{
            id: null,
            title: seed.title,
            description: seed.description || null,
            ranked: opened?.ranked ?? false,
          }}
          ownerName=""
          initialItems={seed.items}
          initialPictures={seed.pictures}
          onDraft={onDraft}
          savedDraft={savedDraft}
        />
      ) : (
        <GroupedListEditor
          key={editorKey}
          list={{
            id: null,
            title: seed.title,
            description: seed.description || null,
            labeled: opened?.labeled ?? true,
          }}
          ownerName=""
          initialGroups={seedGroups}
          initialPictures={seed.pictures}
          onDraft={onDraft}
          savedDraft={savedDraft}
        />
      )}
    </div>
  );
}
