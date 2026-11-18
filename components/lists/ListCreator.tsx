"use client";

import { useState } from "react";
import GroupedListEditor from "@/components/lists/GroupedListEditor";
import ListEditor from "@/components/lists/ListEditor";

type Kind = "plain" | "grouped";

const KINDS: { kind: Kind; label: string; hint: string }[] = [
  { kind: "plain", label: "List", hint: "Items in a row, ranked if you like" },
  {
    kind: "grouped",
    label: "Grouped list",
    hint: "Items sorted into groups, which can have names",
  },
];

// The new-list page when grouped lists are on: pick the kind of list, then
// fill it in
export default function ListCreator() {
  const [kind, setKind] = useState<Kind>("plain");

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
          Kind of list
        </legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <label
              key={k.kind}
              title={k.hint}
              className={`cursor-pointer rounded-lg border px-4 py-2 text-sm ${
                kind === k.kind
                  ? "border-accent text-accent"
                  : "border-line text-foreground"
              }`}
            >
              <input
                type="radio"
                name="list-kind"
                value={k.kind}
                checked={kind === k.kind}
                onChange={() => setKind(k.kind)}
                className="sr-only"
              />
              {k.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">
          {KINDS.find((k) => k.kind === kind)?.hint}. This can&apos;t be changed
          later.
        </p>
      </fieldset>

      {kind === "plain" ? (
        <ListEditor
          list={{ id: null, title: "", description: null, ranked: false }}
          ownerName=""
          initialItems={[]}
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
          initialGroups={[]}
        />
      )}
    </div>
  );
}
