"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import { escapeLike } from "@/lib/username";
import SearchIcon from "./SearchIcon";

type Person = { username: string; avatar_path: string | null };

export default function PeopleSearch() {
  const [open, setOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<Person[]>([]);
  const [resultsFor, setResultsFor] = useState<string>("");
  const wrapper = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const panelId = useId();

  const term = query.trim();
  const ready = term.length >= 2 && resultsFor === term;

  useEffect(() => {
    if (term.length < 2) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await createClient()
        .from("profiles")
        .select("username, avatar_path")
        .ilike("username", `%${escapeLike(term)}%`)
        .order("username")
        .limit(8);
      if (cancelled) return;
      setResults(error || !data ? [] : data);
      setResultsFor(term);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  // Close when you click elsewhere or press Escape
  useEffect(() => {
    if (!open) return;

    function onMouseDown(e: MouseEvent) {
      if (wrapper.current && !wrapper.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={wrapper} className="sm:relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Find people"
        aria-expanded={open}
        aria-controls={panelId}
        title="Find people"
        className={`flex ${open ? "text-foreground" : "text-accent hover:text-foreground"}`}
      >
        <SearchIcon />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute inset-x-2 top-full z-30 mt-2 border border-line bg-background p-2 sm:inset-x-auto sm:left-0 sm:w-72"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && ready && results[0]) {
                router.push(`/u/${encodeURIComponent(results[0].username)}`);
                close();
              }
            }}
            placeholder="Find people by username"
            autoComplete="off"
            // biome-ignore lint/a11y/noAutofocus: this input takes focus on purpose
            autoFocus
            className="w-full border border-line bg-surface px-3 py-2 text-sm text-foreground"
          />

          <ul className="mt-1 flex flex-col">
            {term.length >= 2 && !ready && (
              <li className="px-2 py-2 text-sm text-muted">Searching…</li>
            )}
            {ready && results.length === 0 && (
              <li className="px-2 py-2 text-sm text-muted">No one found.</li>
            )}
            {ready &&
              results.map((p) => (
                <li key={p.username}>
                  <Link
                    href={`/u/${encodeURIComponent(p.username)}`}
                    onClick={close}
                    prefetch={false}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-foreground no-underline hover:bg-surface"
                  >
                    <Avatar name={p.username} path={p.avatar_path} size={20} />
                    <span className="truncate">{p.username}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
