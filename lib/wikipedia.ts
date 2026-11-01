// Everything that talks to Wikipedia and Wikidata. Server-side only.

// Wikimedia asks every client to identify itself. Put your app's name and
// a way to reach you here.
const USER_AGENT = "WikiLog/0.1 (https://example.com; you@example.com)";

// Articles about real people are blocked unless you set this to true
export const ALLOW_PEOPLE = false;

const HEADERS = { "User-Agent": USER_AGENT, "Api-User-Agent": USER_AGENT };

export type SearchHit = {
  key: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
};

export type ItemData = {
  id: string; // the Wikidata ID, like Q89
  title: string;
  description: string | null;
  imageUrl: string | null;
  pageUrl: string;
};

export type LookupResult = { item: ItemData } | { error: string };

// Many images on Wikipedia are non-free (film posters, album covers) and can't
// be reused. Images stored on Wikimedia Commons have free licences, so only
// those are shown.
function freeImage(url: string | undefined | null): string | null {
  if (!url) return null;
  const full = url.startsWith("//") ? `https:${url}` : url;
  return full.includes("/wikipedia/commons/") ? full : null;
}

// Suggestions as you type
export async function searchTitles(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const res = await fetch(
    `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(q)}&limit=8`,
    { headers: HEADERS }
  );
  if (!res.ok) return [];

  const data: {
    pages?: {
      key: string;
      title: string;
      description?: string | null;
      thumbnail?: { url: string } | null;
    }[];
  } = await res.json();

  return (data.pages ?? []).map((p) => ({
    key: p.key,
    title: p.title,
    description: p.description ?? null,
    imageUrl: freeImage(p.thumbnail?.url),
  }));
}

// True if Wikidata says the item is a human. If the check fails, we say yes,
// so a network problem can't let a person's article through.
async function mightBeHuman(qid: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${qid}&property=P31&format=json`,
      { headers: HEADERS }
    );
    if (!res.ok) return true;
    const data: {
      claims?: {
        P31?: { mainsnak?: { datavalue?: { value?: { id?: string } } } }[];
      };
    } = await res.json();
    return (data.claims?.P31 ?? []).some(
      (c) => c.mainsnak?.datavalue?.value?.id === "Q5"
    );
  } catch {
    return true;
  }
}

// An article by its page key, like "Apple" or "Heat_(1995_film)"
export async function getItemByKey(key: string): Promise<LookupResult> {
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`,
    { headers: HEADERS }
  );
  if (!res.ok) return { error: "Couldn't find that article." };

  const data: {
    type?: string;
    title: string;
    description?: string;
    wikibase_item?: string;
    thumbnail?: { source: string };
    content_urls?: { desktop?: { page?: string } };
  } = await res.json();

  if (data.type === "disambiguation") {
    return { error: "That's a disambiguation page. Pick a more specific article." };
  }
  if (data.type !== "standard") return { error: "That page can't be reviewed." };
  if (!data.wikibase_item) {
    return { error: "That article has no Wikidata entry." };
  }

  if (!ALLOW_PEOPLE && (await mightBeHuman(data.wikibase_item))) {
    return { error: "Articles about real people can't be reviewed." };
  }

  return {
    item: {
      id: data.wikibase_item,
      title: data.title,
      description: data.description ?? null,
      imageUrl: freeImage(data.thumbnail?.source),
      pageUrl:
        data.content_urls?.desktop?.page ??
        `https://en.wikipedia.org/wiki/${encodeURIComponent(key)}`,
    },
  };
}

// An article by its Wikidata ID, like "Q89"
export async function getItemById(qid: string): Promise<LookupResult> {
  if (!/^Q\d+$/.test(qid)) return { error: "Invalid item." };

  const res = await fetch(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=sitelinks&sitefilter=enwiki&format=json`,
    { headers: HEADERS }
  );
  if (!res.ok) return { error: "Couldn't reach Wikidata." };

  const data: {
    entities?: Record<string, { sitelinks?: { enwiki?: { title?: string } } }>;
  } = await res.json();

  const title = data.entities?.[qid]?.sitelinks?.enwiki?.title;
  if (!title) return { error: "That item has no English Wikipedia article." };

  return getItemByKey(title.replace(/ /g, "_"));
}