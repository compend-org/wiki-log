"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ItemPicker from "@/components/ItemPicker";
import { loginHref } from "@/lib/redirect";

export default function ItemSearch({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();

  // Signed-out visitors sign in first, then land on the list creator
  const newListHref = signedIn ? "/list/new" : loginHref("/list/new");

  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-3xl font-bold">Log.</h1>
      <p className="text-sm text-muted">
        Search, or paste a Wikipedia article URL:
      </p>
      <ItemPicker onPick={(id) => router.push(`/item/${id}`)} />
      <p className="text-right text-sm text-muted">
        or{" "}
        <Link
          href={newListHref}
          className="text-accent underline hover:no-underline"
        >
          make a list
        </Link>
      </p>
    </section>
  );
}
