// ABOUTME: A search box for picking a person by username, to mention them.
// ABOUTME: Never offers the viewer themselves, nor anyone blocked either way.
"use client";

import { useEffect, useId, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import { useDropdownRoom } from "@/lib/useDropdownRoom";
import { escapeLike } from "@/lib/username";

type Person = { id: string; username: string; avatar_path: string | null };

// The tallest the list of results gets, in pixels
const LIST_HEIGHT = 384;

export default function PersonPicker({
  onPick,
  placeholder = "Search for a person…",
  autoFocus = false,
}: {
  onPick: (person: { id: string; username: string }) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState<string>("");
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleFor, setPeopleFor] = useState<string>("");
  const [active, setActive] = useState<number>(-1);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);

  const term = query.trim();
  const ready = term.length > 0 && peopleFor === term;
  const room = useDropdownRoom(box, term.length > 0, LIST_HEIGHT);

  useEffect(() => {
    if (term.length === 0) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await createClient().rpc("mentionable_people", {
        term: escapeLike(term),
      });
      if (cancelled) return;
      setPeople(error || !data ? [] : (data as Person[]));
      setPeopleFor(term);
      setActive(-1);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, people.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      // Enter never submits the form around the picker
      e.preventDefault();
      if (ready && people.length > 0) onPick(people[Math.max(active, 0)]);
    }
  }

  return (
    <div ref={box} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={term.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        // biome-ignore lint/a11y/noAutofocus: this input takes focus on purpose
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full border border-line bg-surface px-4 py-2 text-foreground"
      />

      {term.length > 0 && (
        <ul
          id={listId}
          // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: combobox popup: focus stays in the input
          role="listbox"
          // Keeps focus in the input while you click an option
          onMouseDown={(e) => e.preventDefault()}
          style={{ maxHeight: room.maxHeight }}
          className={`absolute z-[15] w-full overflow-auto border border-line bg-background ${
            room.above ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {!ready && (
            <li className="px-4 py-3 text-sm text-muted">Searching…</li>
          )}
          {ready && people.length === 0 && (
            <li className="px-4 py-3 text-sm text-muted">No one found.</li>
          )}
          {ready &&
            people.map((p, i) => (
              // biome-ignore lint/a11y/useFocusableInteractive: combobox option: focus stays in the input
              <li
                key={p.id}
                id={`${listId}-${i}`}
                // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: combobox popup: focus stays in the input
                role="option"
                aria-selected={i === active}
              >
                <button
                  type="button"
                  onClick={() => onPick(p)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                    i === active ? "bg-surface" : ""
                  }`}
                >
                  <Avatar name={p.username} path={p.avatar_path} size={20} />
                  <span className="truncate">{p.username}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
