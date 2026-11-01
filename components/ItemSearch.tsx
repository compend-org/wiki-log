"use client";

import { useRouter } from "next/navigation";
import ItemPicker from "@/components/ItemPicker";

export default function ItemSearch() {
  const router = useRouter();

  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-3xl font-bold">Review anything</h1>
      <p className="text-sm text-muted">
        Search for anything with a Wikipedia article: a fruit, a film, a place,
        an idea.
      </p>
      <ItemPicker onPick={(id) => router.push(`/item/${id}`)} />
    </section>
  );
}