"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ItemPicker from "@/components/ItemPicker";
import ItemImage from "@/components/ItemImage";
import { createCompound } from "@/app/actions";

type Part = { id: string; title: string; imageUrl: string | null };

const MAX_PARTS = 8;

export default function CompoundCreator() {
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [parts, setParts] = useState<Part[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [existing, setExisting] = useState<{ id: string; title: string } | null>(
    null
  );
  const router = useRouter();

  function addPart(
    id: string,
    hit: { title: string; imageUrl: string | null }
  ) {
    setExisting(null);
    setError("");
    if (parts.some((p) => p.id === id)) {
      setError("That ingredient is already in the mix.");
      return;
    }
    if (parts.length >= MAX_PARTS) {
      setError(`A compound can have at most ${MAX_PARTS} ingredients.`);
      return;
    }
    setParts([...parts, { id, title: hit.title, imageUrl: hit.imageUrl }]);
  }

  function removePart(id: string) {
    setExisting(null);
    setError("");
    setParts(parts.filter((p) => p.id !== id));
  }

  async function handleCraft() {
    setBusy(true);
    setError("");
    setExisting(null);
    const result = await createCompound({
      title,
      description,
      parts: parts.map((p) => p.id),
    });
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.existing) {
      setExisting(result.existing);
      return;
    }
    if (result.id) {
      router.push(`/item/${result.id}`);
    }
  }

  const ready = title.trim().length > 0 && parts.length >= 2;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Ingredients ({parts.length}/{MAX_PARTS})
        </h2>

        {parts.length > 0 && (
          <ul className="grid grid-cols-4 gap-2">
            {parts.map((p) => (
              <li key={p.id} className="relative flex flex-col gap-1">
                <ItemImage
                  src={p.imageUrl}
                  alt={p.title}
                  className="aspect-square w-full"
                />
                <button
                  type="button"
                  onClick={() => removePart(p.id)}
                  aria-label={`Remove ${p.title}`}
                  className="absolute right-1 top-1 bg-background/80 px-1.5 text-sm"
                >
                  ×
                </button>
                <span className="truncate text-xs">{p.title}</span>
              </li>
            ))}
          </ul>
        )}

        {parts.length < MAX_PARTS && (
          <ItemPicker
            onPick={addPart}
            placeholder={
              parts.length === 0
                ? "Add a first ingredient…"
                : "Add another ingredient…"
            }
          />
        )}
        {parts.length === 1 && (
          <p className="text-xs text-muted">Add at least one more.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        {parts.length >= 2 && (
          <p className="text-sm text-muted">
            {parts.map((p) => p.title).join(" + ")} ={" "}
            <span className="font-semibold text-foreground">
              {title.trim() || "…"}
            </span>
          </p>
        )}
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setExisting(null);
            }}
            maxLength={80}
            placeholder="e.g. Peach Lipton Ice Tea"
            className="border border-line bg-surface px-4 py-2 text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Description (optional)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            className="border border-line bg-surface px-4 py-2 text-foreground"
          />
        </label>
      </section>

      <button
        type="button"
        onClick={handleCraft}
        disabled={!ready || busy}
        className="self-start bg-accent px-6 py-2 text-background disabled:opacity-40"
      >
        {busy ? "Crafting…" : "Craft"}
      </button>

      {existing && (
        <p className="border border-line bg-surface p-3 text-sm">
          That combination already exists:{" "}
          <Link href={`/item/${existing.id}`} className="font-semibold underline">
            {existing.title}
          </Link>
          .
        </p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}