// Everything that talks to Wikipedia and Wikidata. Server-side only.
import { DEFAULT_LANG, LANGUAGES, type LangCode } from "@/lib/languages";

// Wikimedia asks every client to identify itself, with a way to reach you
const CONTACT = process.env.WIKI_CONTACT ?? "no contact set";
const USER_AGENT = `Compend/0.1 (https://compend.org; ${CONTACT})`;

// Articles about real people are blocked unless this is true
export const ALLOW_PEOPLE = true;

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
  imageNonFree: boolean; // true: a fair-use image, shown small with a note
  imageFilePage: string | null; // the page describing the file and its rights
  pageUrl: string;
};

export type LookupResult = { item: ItemData } | { error: string };

type ItemImage = { url: string; nonFree: boolean; filePage: string | null };

function absolute(url: string): string {
  return url.startsWith("//") ? `https:${url}` : url;
}

// Search suggestions only ever show images stored on Wikimedia Commons, whose
// licences allow reuse
function freeImage(url: string | undefined | null): string | null {
  if (!url) return null;
  const full = absolute(url);
  return full.includes("/wikipedia/commons/") ? full : null;
}

// ---------------------------------------------------------------- search

// Suggestions as you type, from the Wikipedia in the chosen language
export async function searchTitles(
  query: string,
  lang: LangCode = DEFAULT_LANG
): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const res = await fetch(
    `https://${lang}.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(q)}&limit=8`,
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
          `${h.title} ${h.description ?? ""}`
        )
    );
}

// -------------------------------------------------------------- wikidata

type Claim = { mainsnak?: { datavalue?: { value?: unknown } } };

// The values of one Wikidata property, or null if the lookup failed
async function getClaimValues(
  qid: string,
  property: string
): Promise<unknown[] | null> {
  try {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${qid}&property=${property}&format=json`,
      { headers: HEADERS }
    );
    if (!res.ok) return null;
    const data: { claims?: Record<string, Claim[]> } = await res.json();
    return (data.claims?.[property] ?? []).map(
      (c) => c.mainsnak?.datavalue?.value
    );
  } catch {
    return null;
  }
}

// True if Wikidata says the item is a human. If the check fails, we say yes,
// so a network problem can't let a person's article through.
async function mightBeHuman(qid: string): Promise<boolean> {
  const types = await getClaimValues(qid, "P31");
  if (types === null) return true;
  return types.some((v) => (v as { id?: string } | undefined)?.id === "Q5");
}

// ----------------------------------------------------------------- images

type ImagePage = {
  title: string;
  imagerepository?: string; // "shared" = Wikimedia Commons, "local" = this wiki
  imageinfo?: {
    thumburl?: string;
    descriptionurl?: string;
    width?: number;
    height?: number;
    mime?: string;
  }[];
  categories?: { title: string }[];
};

type ImageCandidate = {
  fileName: string;
  url: string;
  filePage: string | null;
  free: boolean;
  suitable: boolean;
};

// File names that are almost always page furniture, not a picture of the topic
const JUNK =
  /(logo|icon|symbol|ambox|question[ _]book|commons-|wikimedia|wikipedia|wikidata|edit-clear|stub|portal|disambig|folder|nuvola|crystal|padlock|speaker|loudspeaker|red[ _]pencil|checkmark|ooui|ui-)/i;

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// "Joni_DJRD.jpg" and "Joni DJRD.jpg" are the same file
function sameFile(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.replace(/_/g, " ") === b.replace(/_/g, " ");
}

// The file's name, read from an upload.wikimedia.org address
function fileNameFromUrl(url: string): string | null {
  try {
    const parts = new URL(absolute(url)).pathname.split("/").filter(Boolean);
    if (parts[0] !== "wikipedia") return null;
    const name = parts[2] === "thumb" ? parts[5] : parts[4];
    return name ? decodeURIComponent(name) : null;
  } catch {
    return null;
  }
}

function filePageFor(lang: LangCode, url: string, fileName: string): string {
  const name = encodeURIComponent(fileName.replace(/ /g, "_"));
  return url.includes("/wikipedia/commons/")
    ? `https://commons.wikimedia.org/wiki/File:${name}`
    : `https://${lang}.wikipedia.org/wiki/File:${name}`;
}

// Wikidata's curated "image" property: always a Commons file, so always free
async function wikidataImage(
  qid: string
): Promise<{ url: string; filePage: string | null } | null> {
  try {
    const values = await getClaimValues(qid, "P18");
    const file = values?.find((v) => typeof v === "string") as
      | string
      | undefined;
    if (!file) return null;

    const res = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=330&titles=${encodeURIComponent(`File:${file}`)}`,
      { headers: HEADERS }
    );
    if (!res.ok) return null;
    const data: { query?: { pages?: ImagePage[] } } = await res.json();
    const info = data.query?.pages?.[0]?.imageinfo?.[0];
    const url = freeImage(info?.thumburl);
    return url ? { url, filePage: info?.descriptionurl ?? null } : null;
  } catch {
    return null;
  }
}

// Every picture used on the article, with whether each is free and whether it
// looks like a real picture of the topic (not an icon or a banner)
async function pageImages(
  lang: LangCode,
  title: string
): Promise<ImageCandidate[]> {
  try {
    const res = await fetch(
      `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&generator=images&gimlimit=50&prop=imageinfo|categories&iiprop=url|size|mime&iiurlwidth=330&clcategories=${encodeURIComponent("Category:All free media")}&cllimit=max&titles=${encodeURIComponent(title)}`,
      { headers: HEADERS }
    );
    if (!res.ok) return [];
    const data: { query?: { pages?: ImagePage[] } } = await res.json();

    return (data.query?.pages ?? []).flatMap((p): ImageCandidate[] => {
      const info = p.imageinfo?.[0];
      if (!info?.thumburl) return [];

      const fileName = p.title.replace(/^[^:]+:/, "");
      // Commons files are free. Files stored only on this wiki count as free
      // only if Wikipedia says so, and are treated as non-free otherwise.
      const free =
        p.imagerepository === "shared" ||
        (p.categories ?? []).some((c) => c.title === "Category:All free media");

      const w = info.width ?? 0;
      const h = info.height ?? 0;
      const ratio = h > 0 ? w / h : 0;
      const suitable =
        !!info.mime &&
        PHOTO_TYPES.has(info.mime) &&
        w >= 200 &&
        h >= 150 &&
        ratio >= 0.5 &&
        ratio <= 2.2 &&
        !JUNK.test(fileName);

      return [
        {
          fileName,
          url: absolute(info.thumburl),
          filePage: info.descriptionurl ?? null,
          free,
          suitable,
        },
      ];
    });
  } catch {
    return [];
  }
}

// Picks the picture for an item. Free pictures always win: a free lead image,
// then Wikidata's image, then a free picture from the article. A non-free
// picture is used only when nothing free exists.
async function chooseImage(
  lang: LangCode,
  qid: string,
  title: string,
  leadSource: string | undefined
): Promise<ItemImage | null> {
  const lead = leadSource ? absolute(leadSource) : null;
  const leadFile = lead ? fileNameFromUrl(lead) : null;

  // 1. A lead image on Commons is free
  if (lead && lead.includes("/wikipedia/commons/")) {
    return {
      url: lead,
      nonFree: false,
      filePage: leadFile ? filePageFor(lang, lead, leadFile) : null,
    };
  }

  let candidates: ImageCandidate[] | null = null;
  const getCandidates = async () => (candidates ??= await pageImages(lang, title));

  // 2. A lead image stored only on this wiki can still be marked free
  const leadMatch = lead
    ? (await getCandidates()).find((c) => sameFile(c.fileName, leadFile))
    : undefined;
  if (lead && leadMatch?.free) {
    return { url: lead, nonFree: false, filePage: leadMatch.filePage };
  }

  // 3. Wikidata's picture of the thing itself
  const fromWikidata = await wikidataImage(qid);
  if (fromWikidata) return { ...fromWikidata, nonFree: false };

  // 4. A free picture from the article's text
  const body = (await getCandidates()).filter((c) => c.suitable);
  const freeBody = body.find((c) => c.free);
  if (freeBody) {
    return { url: freeBody.url, nonFree: false, filePage: freeBody.filePage };
  }

  // 5. Only non-free pictures are left: the lead image, else one from the text
  if (lead) {
    return {
      url: lead,
      nonFree: true,
      filePage:
        leadMatch?.filePage ??
        (leadFile ? filePageFor(lang, lead, leadFile) : null),
    };
  }
  const nonFreeBody = body.find((c) => !c.free);
  if (nonFreeBody) {
    return {
      url: nonFreeBody.url,
      nonFree: true,
      filePage: nonFreeBody.filePage,
    };
  }

  return null;
}

// ---------------------------------------------------------------- lookups

// An article by its page key on one language's Wikipedia
export async function getItemByKey(
  key: string,
  lang: LangCode = DEFAULT_LANG
): Promise<LookupResult> {
  const res = await fetch(
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`,
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

  const image = await chooseImage(
    lang,
    data.wikibase_item,
    data.title,
    data.thumbnail?.source
  );

  return {
    item: {
      id: data.wikibase_item,
      title: data.title,
      description: data.description ?? null,
      imageUrl: image?.url ?? null,
      imageNonFree: image?.nonFree ?? false,
      imageFilePage: image?.filePage ?? null,
      pageUrl:
        data.content_urls?.desktop?.page ??
        `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(key)}`,
    },
  };
}

// An item by its Wikidata ID, like "Q89". Uses the English article when there
// is one, so an item looks the same whoever added it, and otherwise the first
// article in any supported language.
export async function getItemById(qid: string): Promise<LookupResult> {
  if (!/^Q\d+$/.test(qid)) return { error: "Invalid item." };

  const sites = LANGUAGES.map((l) => `${l.code}wiki`).join("|");
  const res = await fetch(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=sitelinks&sitefilter=${encodeURIComponent(sites)}&format=json`,
    { headers: HEADERS }
  );
  if (!res.ok) return { error: "Couldn't reach Wikidata." };

  const data: {
    entities?: Record<string, { sitelinks?: Record<string, { title?: string }> }>;
  } = await res.json();

  const links = data.entities?.[qid]?.sitelinks ?? {};
  const order: LangCode[] = [
    DEFAULT_LANG,
    ...LANGUAGES.map((l) => l.code).filter((c) => c !== DEFAULT_LANG),
  ];

  for (const code of order) {
    const title = links[`${code}wiki`]?.title;
    if (title) return getItemByKey(title.replace(/ /g, "_"), code);
  }

  return { error: "That item has no article in a supported language." };
}