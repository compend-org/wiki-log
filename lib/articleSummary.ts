// ABOUTME: Reads Wikipedia's article summaries, in the browser and on the server,
// ABOUTME: and decides whether an article can become an item.
import type { LangCode } from "@/lib/languages";

export const BUSY_ERROR = "Wikipedia is busy right now. Try again in a minute.";

export type ArticleSummary = {
  type?: string;
  title: string;
  description?: string;
  wikibase_item: string;
  thumbnail?: { source: string };
  content_urls?: { desktop?: { page?: string } };
};

export function summaryUrl(lang: LangCode, key: string): string {
  return `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`;
}

// The summary in this response, or why the article can't become an item
export async function readSummary(
  res: Response,
): Promise<{ summary: ArticleSummary } | { error: string }> {
  if (res.status === 429 || res.status >= 500) return { error: BUSY_ERROR };
  if (!res.ok) return { error: "Couldn't find that article." };

  const data: Omit<ArticleSummary, "wikibase_item"> & {
    wikibase_item?: string;
  } = await res.json();

  if (data.type === "disambiguation") {
    return {
      error: "That's a disambiguation page. Pick a more specific article.",
    };
  }
  if (data.type !== "standard")
    return { error: "That page can't be reviewed." };
  if (!data.wikibase_item) {
    return { error: "That article has no Wikidata entry." };
  }
  return { summary: { ...data, wikibase_item: data.wikibase_item } };
}
