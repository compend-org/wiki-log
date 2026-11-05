// ABOUTME: Searches Wikipedia article titles and finds an article's Wikidata item, from the visitor's browser.
// ABOUTME: Search holds off while Wikimedia has asked for a wait; finding an item waits it out.
import { BUSY_ERROR, readSummary, summaryUrl } from "@/lib/articleSummary";
import { freeImage } from "@/lib/format";
import type { LangCode } from "@/lib/languages";
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
  title: string;
  description: string | null;
  imageUrl: string | null;
};

// Waits Wikimedia has asked of this browser
const pause: Pause = { until: 0 };

// Suggestions as you type, from the Wikipedia in the chosen language
export async function searchTitles(
  query: string,
  lang: LangCode,
  signal?: AbortSignal,
): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH || q.length > MAX_QUERY_LENGTH) return [];

  if (Date.now() < pause.until) throw new Error("Waiting on Wikipedia");

  let res: Response;
  try {
    res = await fetch(
      `https://${lang}.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(q)}&limit=8`,
      { headers: { "Api-User-Agent": API_USER_AGENT }, signal },
    );
  } catch (e) {
    // A rate limit response without CORS headers also lands here, since the
    // browser hides it from this code
    if (!signal?.aborted) pause.until = Date.now() + DEFAULT_WAIT_MS;
    throw e;
  }

  pause.until = Math.max(pause.until, Date.now() + requestedWaitMs(res));
  if (!res.ok) throw new Error(`Wikipedia search failed: ${res.status}`);

  const data: {
    pages?: {
      key: string;
      title: string;
      description?: string | null;
      thumbnail?: { url: string } | null;
    }[];
  } = await res.json();

  return (data.pages ?? [])
    .map((p) => ({
      key: p.key,
      title: p.title,
      description: p.description ?? null,
      imageUrl: freeImage(p.thumbnail?.url),
    }))
    .filter(
      (h) =>
        !/disambiguation|topics referred to by the same term/i.test(
          `${h.title} ${h.description ?? ""}`,
        ),
    );
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
