"use client";

import { useRouter } from "next/navigation";
import ItemPicker from "@/components/ItemPicker";

export default function ItemSearch() {
    const router = useRouter();

    return (
        <section className="flex flex-col gap-3">
            <h1 className="text-3xl font-bold">Log it</h1>
            <p className="text-sm text-muted">
                You'll find most things.
            </p>
            <ItemPicker onPick={(id) => router.push(`/item/${id}`)} />
        </section>
    );
}