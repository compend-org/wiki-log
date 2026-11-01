"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { escapeLike } from "@/lib/username";
import ItemImage from "@/components/ItemImage";

type Person = { username: string };
type ItemResult = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
};

async function searchPeople(term: string): Promise<Person[]> {
  const { data, error } = await createClient()
    .from("profiles")
    .select("username")
    .ilike("username", `%${escapeLike(term)}%`)
    .order("username")
    .limit(10);
  return error || !data ? [] : data;
}

async function searchItems(term: string): Promise<ItemResult[]> {
  const { data, error } = await createClient()
    .from("items")
    .select("id, title, description, image_url")
    .ilike("title", `%${escapeLike(term)}%`)
    .order("title")
    .limit(20);
  return error || !data ? [] : data;
}

export default function SearchPage() {
  const [query, setQuery] = useState<string>("");
  const [people, setPeople] = useState<Person[]>([]);
  const [items, setItems] = useState<ItemResult[]>([]);
  const [resultsFor, setResultsFor] = useState<string>("");

  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const [p, i] = await Promise.all([searchPeople(term), searchItems(term)]);
      if (cancelled) return;
      setPeople(p);
      setItems(i);
      setResultsFor(term);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  const ready = term.length >= 2 && resultsFor === term;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Search</h1>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Reviewed items or people"
        autoFocus
        className="rounded-lg border border-line bg-surface px-4 py-2 text-foreground"
      />

      {term.length < 2 && (
        <p className="text-sm text-muted">Type at least 2 characters.</p>
      )}

      {term.length >= 2 && !ready && (
        <p className="text-sm text-muted">Searching…</p>
      )}

      {ready && people.length === 0 && items.length === 0 && (
        <p className="text-muted">No results.</p>
      )}

      {ready && items.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Items
          </h2>
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/item/${item.id}`}
              className="card flex items-center gap-3 p-3"
            >
              <ItemImage
                src={item.image_url}
                alt={item.title}
                className="h-14 w-14 shrink-0 rounded"
              />
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{item.title}</span>
                {item.description && (
                  <span className="truncate text-sm text-muted">
                    {item.description}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </section>
      )}

      {ready && people.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            People
          </h2>
          {people.map((person) => (
            <Link
              key={person.username}
              href={`/u/${encodeURIComponent(person.username)}`}
              className="card px-4 py-3 font-semibold"
            >
              {person.username}
            </Link>
          ))}
        </section>
      )}

      <p className="text-sm text-muted">
        Can&apos;t find what you want to review? Search all of Wikipedia from{" "}
        <Link href="/" className="underline">
          the home page
        </Link>
        .
      </p>
    </main>
  );
}