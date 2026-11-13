// ABOUTME: A search box for picking an item, from Wikipedia results, matching compounds or a pasted link.
// ABOUTME: In SFW mode, result pictures wait on an adult content check and are blurred when adult.
"use client";

import { useEffect, useId, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import ItemPicture from "@/components/ItemPicture";
import LanguagePicker from "@/components/LanguagePicker";
import {
  explicitCommonsFiles,
  findItemId,
  searchTitles,
} from "@/lib/browserWikipedia";
import { FEATURES } from "@/lib/features";
import { fileNameFromUrl, fileTitle, freeImage } from "@/lib/format";
import { DEFAULT_LANG, isLang, type LangCode } from "@/lib/languages";
import { useDropdownRoom } from "@/lib/useDropdownRoom";
import { useSfwMode } from "@/lib/useSfwMode";

type Hit = {
  key: string;
  itemId?: string; // set for compounds, which need no lookup
  wikidataId?: string | null; // set for Wikipedia results that have one
  title: string;
  description: string | null;
  imageUrl: string | null;
  lang?: LangCode; // set for pasted links, which carry their own language
  // In SFW mode, where checking the picture for adult content has got to
  // (unset: shown as usual)
  pictureCheck?: "checking" | "adult" | "failed";
};

const LANG_KEY = "search-lang";

// The tallest the list of results gets, in pixels
const LIST_HEIGHT = 384;

// Matching compounds. A failure here leaves the Wikipedia results to show alone.
async function searchCompounds(q: string, signal: AbortSignal): Promise<Hit[]> {
  if (!FEATURES.compounds) return [];
  try {
    const res = await fetch(`/api/compounds?q=${encodeURIComponent(q)}`, {
      signal,
    });
    if (!res.ok) return [];
    const data: { results: Hit[] } = await res.json();
    return data.results;
  } catch {
    return [];
  }
}

// The results whose pictures are adult content or couldn't be checked, by
// key: saved items by their flag, files by the bad image list and their
// Commons categories. A picture is adult if any check that worked flagged it,
// and unchecked if a check covering it failed and none flagged it.
async function checkPictures(
  hits: Hit[],
  signal: AbortSignal,
): Promise<Map<string, "adult" | "failed">> {
  const pictured = hits.flatMap((hit) => {
    if (!hit.imageUrl) return [];
    const file = fileNameFromUrl(hit.imageUrl);
    return [
      {
        key: hit.key,
        id: hit.itemId ?? hit.wikidataId ?? null,
        file: file ? fileTitle(file) : null,
        onCommons: freeImage(hit.imageUrl) !== null,
      },
    ];
  });

  const params = new URLSearchParams();
  for (const p of pictured) {
    if (p.id) params.append("id", p.id);
    if (p.file) params.append("file", p.file);
  }
  const commonsFiles = pictured.flatMap((p) =>
    p.file && p.onCommons ? [p.file] : [],
  );

  const [ours, commons] = await Promise.allSettled([
    fetch(`/api/adult-content?${params}`, { signal }).then(async (res) => {
      if (!res.ok) throw new Error(`Adult content check failed: ${res.status}`);
      return (await res.json()) as {
        ids: string[] | null;
        files: string[] | null;
      };
    }),
    explicitCommonsFiles(commonsFiles, signal),
  ]);

  // What each check flagged, or null where it failed
  const ourIds = ours.status === "fulfilled" ? ours.value.ids : null;
  const ourFiles = ours.status === "fulfilled" ? ours.value.files : null;
  const commonsFlagged = commons.status === "fulfilled" ? commons.value : null;

  const checks = new Map<string, "adult" | "failed">();
  for (const p of pictured) {
    const flagged =
      (!!p.id && !!ourIds?.includes(p.id)) ||
      (!!p.file && !!ourFiles?.includes(p.file)) ||
      (!!p.file && !!commonsFlagged?.has(p.file));
    const failed =
      (!!p.id && !ourIds) ||
      (!!p.file && !ourFiles) ||
      (!!p.file && p.onCommons && !commonsFlagged);

    if (flagged) checks.set(p.key, "adult");
    else if (failed) checks.set(p.key, "failed");
  }
  return checks;
}

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
  const [failedFor, setFailedFor] = useState<string>("");
  const [open, setOpen] = useState<boolean>(false);
  const [active, setActive] = useState<number>(-1);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);

  const term = query.trim();
  // Results are for a search in one SFW mode, so when the mode turns on, such
  // as when the account's mode arrives after the results, unchecked pictures
  // stop showing and the search runs again with checks
  const checking = useSfwMode() !== "off";
  const searchKey = `${lang}:${checking}:${term}`;
  const listOpen = open && term.length >= 2;
  const room = useDropdownRoom(box, listOpen, LIST_HEIGHT);

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
  const failed = !ready && failedFor === searchKey;

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
        const [compounds, titles] = await Promise.all([
          searchCompounds(term, controller.signal),
          searchTitles(term, lang, controller.signal),
        ]);
        const found: Hit[] = [...compounds, ...titles];
        setHits(
          checking
            ? found.map((h) =>
                h.imageUrl ? { ...h, pictureCheck: "checking" } : h,
              )
            : found,
        );
        setHitsFor(`${lang}:${checking}:${term}`);
        setActive(-1);
        if (!checking) return;

        const checks = await checkPictures(found, controller.signal);
        if (controller.signal.aborted) return;
        setHits(
          found.map((h) => {
            const check = checks.get(h.key);
            return check ? { ...h, pictureCheck: check } : h;
          }),
        );
      } catch {
        // A newer keystroke cancels this search, which isn't a failure
        if (!controller.signal.aborted)
          setFailedFor(`${lang}:${checking}:${term}`);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, lang, checking]);

  async function choose(hit: Hit) {
    setBusy(true);
    setError("");
    try {
      let id = hit.itemId;
      if (!id) {
        // Pasted links carry their own language, searches use the picker's
        const found = await findItemId(hit.key, hit.lang ?? lang);
        if ("error" in found) {
          setError(found.error);
          setBusy(false);
          return;
        }
        id = found.id;
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
        choose(shownHits[Math.max(active, 0)]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/** biome-ignore lint/a11y/noStaticElementInteractions: closes the menu on events from the controls inside it */}
      <div
        ref={box}
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
            // biome-ignore lint/a11y/noAutofocus: this input takes focus on purpose
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
            // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: combobox popup: focus stays in the input
            role="listbox"
            // Keeps focus in the input while you click an option
            onMouseDown={(e) => e.preventDefault()}
            style={{ maxHeight: room.maxHeight }}
            className={`absolute z-[15] w-full overflow-auto border border-line bg-background ${
              room.above ? "bottom-full mb-1" : "top-full mt-1"
            }`}
          >
            {error && (
              <li role="alert" className="px-4 py-3 text-sm text-danger">
                {error}
              </li>
            )}
            {busy && (
              <li
                role="status"
                className="flex items-center gap-2 px-4 py-3 text-sm text-muted"
              >
                <Avatar path={null} size={20} className="animate-spin" />
                Fetching from Wikipedia…
              </li>
            )}
            {unsupported && (
              <li className="px-4 py-3 text-sm text-muted">
                That Wikipedia&apos;s language isn&apos;t supported yet.
              </li>
            )}
            {!unsupported && !ready && !failed && (
              <li className="px-4 py-3 text-sm text-muted">Searching…</li>
            )}
            {!unsupported && failed && (
              <li className="px-4 py-3 text-sm text-muted">
                Wikipedia is busy right now. Try again in a minute, or paste a
                Wikipedia link.
              </li>
            )}
            {!unsupported && ready && shownHits.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted">
                No results. You can also paste a Wikipedia link.
              </li>
            )}
            {!unsupported &&
              ready &&
              shownHits.map((hit, i) => (
                // biome-ignore lint/a11y/useFocusableInteractive: combobox option: focus stays in the input
                <li
                  key={hit.key}
                  id={`${listId}-${i}`}
                  // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: combobox popup: focus stays in the input
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
                    {hit.pictureCheck === "checking" ? (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-line/50">
                        <Avatar
                          path={null}
                          size={20}
                          className="animate-spin"
                        />
                      </div>
                    ) : hit.imageUrl && hit.pictureCheck !== "failed" ? (
                      <ItemPicture
                        src={hit.imageUrl}
                        alt=""
                        nsfw={hit.pictureCheck === "adult"}
                        tapToShow={false}
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

      {/* While the results are open, the error shows at the top of them */}
      {error && !listOpen && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
