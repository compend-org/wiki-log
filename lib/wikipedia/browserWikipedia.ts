// ABOUTME: Searches Wikipedia article titles, checks pictures for explicit content, and finds an article's Wikidata item, from the visitor's browser.
// ABOUTME: Search holds off while Wikimedia has asked for a wait; finding an item waits it out.
import { BUSY_ERROR, readSummary, summaryUrl } from "@/lib/articleSummary";
import { fileTitle, freeImage } from "@/lib/format";
import type { LangCode } from "@/lib/languages";
import { EXPLICIT_CATEGORY } from "@/lib/sfw";
import {
  DEFAULT_WAIT_MS,
  type Pause,
  requestedWaitMs,
  sendWithinDeadline,
  WAIT_BUDGET_MS,
} from "@/lib/wikimediaLimits";

// Browsers can't set User-Agent, so Wikimedia reads this header instead
const API_USER_AGENT = "Compend/0.1 (https://compend.org)";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;

export type SearchHit = {
  key: string;
  wikidataId: string | null; // when the article has one
  title: string;
  description: string | null;
  imageUrl: string | null;
};

// Waits Wikimedia has asked of this browser
const pause: Pause = { until: 0 };

// Sends an API request from this browser unless Wikimedia has asked it to
// wait, remembers any wait the response asks for, and reads the answer. Throws
// if it doesn't succeed, including errors the API reports with a 200 status.
async function askWikimedia<T>(url: string, signal?: AbortSignal): Promise<T> {
  if (Date.now() < pause.until) throw new Error("Waiting on Wikipedia");

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "Api-User-Agent": API_USER_AGENT },
      signal,
    });
  } catch (e) {
    // A rate limit response without CORS headers also lands here, since the
    // browser hides it from this code
    if (!signal?.aborted) pause.until = Date.now() + DEFAULT_WAIT_MS;
    throw e;
  }

  pause.until = Math.max(pause.until, Date.now() + requestedWaitMs(res));
  if (!res.ok) throw new Error(`Wikimedia request failed: ${res.status}`);
  const data: T & { error?: { code: string } } = await res.json();
  if (data.error) throw new Error(`Wikimedia API error: ${data.error.code}`);
  return data;
}

// Suggestions as you type, from the Wikipedia in the chosen language
export async function searchTitles(
  query: string,
  lang: LangCode,
  signal?: AbortSignal,
): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH || q.length > MAX_QUERY_LENGTH) return [];

  const data = await askWikimedia<{
    query?: {
      pages?: {
        index: number;
        title: string;
        description?: string;
        pageprops?: { wikibase_item?: string };
        thumbnail?: { source: string };
      }[];
    };
  }>(
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&redirects=1&generator=prefixsearch&gpslimit=8&gpssearch=${encodeURIComponent(q)}&prop=pageprops|pageimages|description&ppprop=wikibase_item&piprop=thumbnail&pithumbsize=60`,
    signal,
  );

  return (data.query?.pages ?? [])
    .sort((a, b) => a.index - b.index)
    .map((p) => ({
      key: p.title.replace(/ /g, "_"),
      wikidataId: p.pageprops?.wikibase_item ?? null,
      title: p.title,
      description: p.description ?? null,
      imageUrl: freeImage(p.thumbnail?.source),
    }))
    .filter(
      (h) =>
        !/disambiguation|topics referred to by the same term/i.test(
          `${h.title} ${h.description ?? ""}`,
        ),
    );
}

// Which of these Commons files are filed under categories that describe
// explicit pictures, asked in one request. Throws if the answer doesn't fit
// in one response, since the files left out would read as not explicit.
export async function explicitCommonsFiles(
  fileNames: string[],
  signal?: AbortSignal,
): Promise<Set<string>> {
  if (fileNames.length === 0) return new Set();

  const titles = fileNames.map((name) => `File:${fileTitle(name)}`).join("|");
  const data = await askWikimedia<{
    continue?: unknown;
    query?: {
      pages?: { title: string; categories?: { title: string }[] }[];
    };
  }>(
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&prop=categories&cllimit=max&titles=${encodeURIComponent(titles)}`,
    signal,
  );

  if (data.continue) throw new Error("Too many categories to check at once");

  const explicit = new Set(
    (data.query?.pages ?? [])
      .filter((p) =>
        (p.categories ?? []).some((c) => EXPLICIT_CATEGORY.test(c.title)),
      )
      .map((p) => p.title.replace(/^File:/, "")),
  );
  return new Set(fileNames.filter((name) => explicit.has(fileTitle(name))));
}

// The Wikidata item for an article, or why it can't become one. While
// Wikimedia asks this browser to wait, keeps waiting up to the wait budget.
// The server checks the item again before saving anything.
export async function findItemId(
  key: string,
  lang: LangCode,
): Promise<{ id: string } | { error: string }> {
  const res = await sendWithinDeadline(
    async (signal) => {
      try {
        return await fetch(summaryUrl(lang, key), {
          headers: { "Api-User-Agent": API_USER_AGENT },
          signal,
        });
      } catch (e) {
        if (signal.aborted) throw e;
        // A rate limit response without CORS headers also lands here, since
        // the browser hides it from this code
        return new Response(null, { status: 429 });
      }
    },
    pause,
    Date.now() + WAIT_BUDGET_MS,
  );
  if (!res) return { error: BUSY_ERROR };

  const read = await readSummary(res);
  return "error" in read ? read : { id: read.summary.wikibase_item };
}
