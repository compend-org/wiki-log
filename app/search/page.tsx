"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { USE_STUB } from "@/lib/video";

type Person = { username: string; };
type VideoResult = { id: string; title: string; channel_name: string | null };

// In SQL patterns, % and _ are wildcards, so escape them
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&");
}

async function searchPeople(term: string): Promise<Person[]> {
  if (term.length < 2) return [];
  const { data, error } = await createClient()
    .from("profiles")
    .select("username")
    .ilike("username", `%${escapeLike(term)}%`)
    .order("username")
    .limit(10);
  return error || !data ? [] : data;
}

async function searchVideos(term: string): Promise<VideoResult[]> {
  const supabase = createClient();
  const pattern = `%${escapeLike(term)}%`;

  // Two separate queries keep user input out of any filter syntax
  const [byTitle, byChannel] = await Promise.all([
    supabase
      .from("videos")
      .select("id, title, channel_name")
      .ilike("title", pattern)
      .limit(20),
    supabase
      .from("videos")
      .select("id, title, channel_name")
      .ilike("channel_name", pattern)
      .limit(20),
  ]);

  const merged = new Map<string, VideoResult>();
  for (const row of [...(byTitle.data ?? []), ...(byChannel.data ?? [])]) {
    if (!merged.has(row.id)) merged.set(row.id, row);
  }
  return [...merged.values()].slice(0, 20);
}

export default function SearchPage() {
  const [query, setQuery] = useState<string>("");
  const [people, setPeople] = useState<Person[]>([]);
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [resultsFor, setResultsFor] = useState<string>("");

  const term = query.trim();
  // Usernames are lowercase letters, numbers and underscores only
  const userTerm = term.toLowerCase().replace(/[^a-z0-9_]/g, "");

  useEffect(() => {
    if (term.length < 2) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const [p, v] = await Promise.all([
        searchPeople(userTerm),
        searchVideos(term),
      ]);
      if (cancelled) return;
      setPeople(p);
      setVideos(v);
      setResultsFor(term);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, userTerm]);

  const ready = term.length >= 2 && resultsFor === term;

  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Search</h1>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Videos, channels or people"
        autoFocus
        className="rounded-lg border border-line bg-surface px-4 py-2 text-foreground"
      />

      {term.length < 2 && (
        <p className="text-sm text-muted">Type at least 2 characters.</p>
      )}

      {term.length >= 2 && !ready && (
        <p className="text-sm text-muted">Searching…</p>
      )}

      {ready && people.length === 0 && videos.length === 0 && (
        <p className="text-muted">No results.</p>
      )}

      {ready && people.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            People
          </h2>
          {people.map((person) => (
            <Link
              key={person.username}
              href={`/u/${person.username}`}
              className="flex flex-col rounded-lg border border-line px-4 py-3"
            >
              <span className="font-semibold">
                {person.username}
              </span>
              <span className="text-sm text-muted">@{person.username}</span>
            </Link>
          ))}
        </section>
      )}

      {ready && videos.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Videos
          </h2>
          {videos.map((video) => (
            <Link
              key={video.id}
              href={`/video/${video.id}`}
              className="flex gap-4 rounded-lg border border-line p-3"
            >
              {USE_STUB ? (
                <div className="aspect-video w-32 shrink-0 rounded bg-surface" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`}
                  alt={video.title}
                  className="aspect-video w-32 shrink-0 rounded object-cover"
                />
              )}
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-semibold">{video.title}</span>
                {video.channel_name && (
                  <span className="text-sm text-muted">
                    {video.channel_name}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}