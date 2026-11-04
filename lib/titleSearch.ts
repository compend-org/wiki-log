// ABOUTME: Searches Wikipedia article titles from the visitor's browser.
// ABOUTME: Throws when the search fails, and holds off while Wikimedia has asked for a wait.
import { freeImage } from "@/lib/format";
import type { LangCode } from "@/lib/languages";
import { DEFAULT_WAIT_MS, requestedWaitMs } from "@/lib/wikimediaLimits";

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

let pausedUntil = 0;

// Suggestions as you type, from the Wikipedia in the chosen language
export async function searchTitles(
  query: string,
  lang: LangCode,
  signal?: AbortSignal,
): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH || q.length > MAX_QUERY_LENGTH) return [];

  if (Date.now() < pausedUntil) throw new Error("Waiting on Wikipedia");

  let res: Response;
  try {
    res = await fetch(
      `https://${lang}.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(q)}&limit=8`,
      { headers: { "Api-User-Agent": API_USER_AGENT }, signal },
    );
  } catch (e) {
    // A rate limit response without CORS headers also lands here, since the
    // browser hides it from this code
    if (!signal?.aborted) pausedUntil = Date.now() + DEFAULT_WAIT_MS;
    throw e;
  }

  pausedUntil = Math.max(pausedUntil, Date.now() + requestedWaitMs(res));
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
