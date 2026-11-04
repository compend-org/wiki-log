"use client";

import { useEffect, useId, useState } from "react";
import LanguagePicker from "@/components/LanguagePicker";
import { DEFAULT_LANG, isLang, type LangCode } from "@/lib/languages";

type Hit = {
  key: string;
  itemId?: string; // set for compounds, which need no lookup
  title: string;
  description: string | null;
  imageUrl: string | null;
  lang?: LangCode; // set for pasted links, which carry their own language
};

const LANG_KEY = "search-lang";

// A pasted Wikipedia address: which wiki, and which article
function parseWikipediaUrl(
  input: string,
): { lang: string; key: string; title: string } | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  const host = /^([a-z-]+)(?:\.m)?\.wikipedia\.org$/i.exec(url.hostname);
  if (!host) return null;

  let key = "";
  if (url.pathname.startsWith("/wiki/")) key = url.pathname.slice(6);
  else if (url.pathname === "/w/index.php") {
    key = url.searchParams.get("title") ?? "";
  }
  if (!key) return null;

  try {
    key = decodeURIComponent(key);
  } catch {
    return null;
  }
  key = key.replace(/ /g, "_");

  return { lang: host[1].toLowerCase(), key, title: key.replace(/_/g, " ") };
}

export default function ItemPicker({
  onPick,
  placeholder = "Banana, Vanessa Redgrave, Mesopotamia...",
  autoFocus = false,
}: {
  onPick: (
    itemId: string,
    hit: { title: string; imageUrl: string | null },
  ) => void | Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState<string>("");
  const [lang, setLang] = useState<LangCode>(DEFAULT_LANG);
  const [hits, setHits] = useState<Hit[]>([]);
  const [hitsFor, setHitsFor] = useState<string>("");
  const [open, setOpen] = useState<boolean>(false);
  const [active, setActive] = useState<number>(-1);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const listId = useId();

  const term = query.trim();
  const searchKey = `${lang}:${term}`;
  const listOpen = open && term.length >= 2;

  // A pasted link replaces searching: it is the one result
  const pasted = parseWikipediaUrl(term);
  const unsupported = pasted !== null && !isLang(pasted.lang);
  const shownHits: Hit[] =
    pasted && !unsupported
      ? [
          {
            key: pasted.key,
            title: pasted.title,
            description: `From ${pasted.lang}.wikipedia.org. Press Enter to fetch it.`,
            imageUrl: null,
            lang: pasted.lang as LangCode,
          },
        ]
      : hits;
  const ready = pasted ? true : hitsFor === searchKey;

  // Remember the chosen language between visits
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LANG_KEY);
      if (stored && isLang(stored)) setLang(stored);
    } catch {
      // Storage can be blocked; the default language is fine
    }
  }, []);

  function changeLang(next: LangCode) {
    setLang(next);
    setActive(-1);
    setError("");
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      // The choice just won't be remembered
    }
  }

  useEffect(() => {
    if (term.length < 2 || parseWikipediaUrl(term)) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(term)}&lang=${lang}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data: { results: Hit[] } = await res.json();
        setHits(data.results);
        setHitsFor(`${lang}:${term}`);
        setActive(-1);
      } catch {
        // Cancelled by a newer keystroke, or the network failed
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, lang]);

  async function choose(hit: Hit) {
    setBusy(true);
    setError("");
    try {
      let id = hit.itemId;
      if (!id) {
        // Pasted links carry their own language, searches use the picker's
        const useLang = hit.lang ?? lang;
        const res = await fetch(
          `/api/resolve?key=${encodeURIComponent(hit.key)}&lang=${useLang}`,
        );
        const data: { id?: string; error?: string } = await res.json();
        if (!res.ok || !data.id) {
          setError(data.error ?? "Something went wrong.");
          setBusy(false);
          return;
        }
        id = data.id;
      }
      await onPick(id, { title: hit.title, imageUrl: hit.imageUrl });
      setQuery("");
      setOpen(false);
    } catch {
      setError("Couldn't reach the server.");
    }
    setBusy(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, shownHits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (listOpen && ready && shownHits.length > 0 && !busy) {
        e.preventDefault();
        choose(shownHits[active >= 0 ? active : 0]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setOpen(false);
          }
        }}
      >
        <div className="flex gap-2">
          <input
            type="text"
            role="combobox"
            aria-expanded={listOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              active >= 0 ? `${listId}-${active}` : undefined
            }
            autoComplete="off"
            autoFocus={autoFocus}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setError("");
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-w-0 flex-1 border border-line bg-surface px-4 py-2 text-foreground"
          />
          <LanguagePicker value={lang} onChange={changeLang} />
        </div>

        {listOpen && (
          <ul
            id={listId}
            role="listbox"
            // Keeps focus in the input while you click an option
            onMouseDown={(e) => e.preventDefault()}
            className="absolute z-[15] mt-1 max-h-96 w-full overflow-auto border border-line bg-background"
          >
            {unsupported && (
              <li className="px-4 py-3 text-sm text-muted">
                That Wikipedia&apos;s language isn&apos;t supported yet.
              </li>
            )}
            {!unsupported && !ready && (
              <li className="px-4 py-3 text-sm text-muted">Searching…</li>
            )}
            {!unsupported && ready && shownHits.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted">
                No results. You can also paste a Wikipedia link.
              </li>
            )}
            {!unsupported &&
              ready &&
              shownHits.map((hit, i) => (
                <li
                  key={hit.key}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                >
                  <button
                    type="button"
                    onClick={() => choose(hit)}
                    onMouseEnter={() => setActive(i)}
                    disabled={busy}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left disabled:opacity-60 ${
                      i === active ? "bg-surface" : ""
                    }`}
                  >
                    {hit.imageUrl ? (
                      // biome-ignore lint/performance/noImgElement: a plain img is intended
                      <img
                        src={hit.imageUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 shrink-0 bg-line/50" />
                    )}
                    <span className="flex min-w-0 flex-col">
                      <span dir="auto" className="truncate font-semibold">
                        {hit.title}
                      </span>
                      {hit.description && (
                        <span
                          dir="auto"
                          className="truncate text-xs text-muted"
                        >
                          {hit.description}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
