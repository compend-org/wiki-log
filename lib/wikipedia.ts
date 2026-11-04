// Item lookups on Wikipedia and Wikidata. Server-side only.
import { absolute, freeImage } from "@/lib/format";
import { DEFAULT_LANG, LANGUAGES, type LangCode } from "@/lib/languages";
import { requestedWaitMs } from "@/lib/wikimediaLimits";

// Wikimedia asks every client to identify itself, with a way to reach you
const CONTACT = process.env.WIKI_CONTACT ?? "no contact set";
const USER_AGENT = `Compend/0.1${process.env.NODE_ENV === "production" ? "" : "-dev"} (https://compend.org; ${CONTACT})`;

// Articles about real people are blocked unless this is true
export const ALLOW_PEOPLE = true;

const HEADERS = { "User-Agent": USER_AGENT, "Api-User-Agent": USER_AGENT };

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

// -------------------------------------------------------------- wikidata

type Claim = { mainsnak?: { datavalue?: { value?: unknown } } };

// The values of one Wikidata property, or null if the lookup failed
async function getClaimValues(
  qid: string,
  property: string,
): Promise<unknown[] | null> {
  try {
    const res = await wikiFetch(
      `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${qid}&property=${property}&format=json`,
      { headers: HEADERS },
    );
    if (!res.ok) return null;
    const data: { claims?: Record<string, Claim[]> } = await res.json();
    return (data.claims?.[property] ?? []).map(
      (c) => c.mainsnak?.datavalue?.value,
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
    url?: string;
    width?: number;
    height?: number;
    mime?: string;
    descriptionurl?: string;
  }[];
  categories?: { title: string }[];
};

// These checks exclude page furniture, not establish semantic relevance.
const PAGE_FURNITURE =
  /(logo|icon|symbol|ambox|question[ _]book|commons-|wikimedia|wikipedia|wikidata|edit-clear|stub|portal|disambig|folder|nuvola|crystal|padlock|speaker|loudspeaker|red[ _]pencil|checkmark|ooui|ui-)/i;
const PICTURE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function fileIsFree(page: ImagePage | undefined): boolean {
  return (
    page?.imagerepository === "shared" ||
    (page?.categories ?? []).some((c) => c.title === "Category:All free media")
  );
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
  qid: string,
): Promise<{ url: string; filePage: string | null } | null> {
  try {
    const values = await getClaimValues(qid, "P18");
    const file = values?.find((v) => typeof v === "string") as
      | string
      | undefined;
    if (!file) return null;

    const res = await wikiFetch(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=960&titles=${encodeURIComponent(`File:${file}`)}`,
      { headers: HEADERS },
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

// Check the rights of the selected lead file itself. Other images in the
// article may depict its author, setting, or another related topic.
async function leadImage(lang: LangCode, url: string): Promise<ItemImage> {
  const fileName = fileNameFromUrl(url);
  const fallback: ItemImage = {
    url,
    nonFree: !url.includes("/wikipedia/commons/"),
    filePage: fileName ? filePageFor(lang, url, fileName) : null,
  };
  if (!fallback.nonFree || !fileName) return fallback;

  try {
    const res = await wikiFetch(
      `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo|categories&iiprop=url&clcategories=${encodeURIComponent("Category:All free media")}&titles=${encodeURIComponent(`File:${fileName}`)}`,
      { headers: HEADERS },
    );
    if (!res.ok) return fallback;
    const data: { query?: { pages?: ImagePage[] } } = await res.json();
    const page = data.query?.pages?.[0];
    return {
      url,
      nonFree: !fileIsFree(page),
      filePage: page?.imageinfo?.[0]?.descriptionurl ?? fallback.filePage,
    };
  } catch {
    return fallback;
  }
}

// The summary can omit a thumbnail even when PageImages has selected one.
// Ask for any licence: the default free-only choice may depict a related topic.
async function representativeImage(
  lang: LangCode,
  title: string,
): Promise<ItemImage | null> {
  try {
    const res = await wikiFetch(
      `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=pageimages&piprop=thumbnail&pithumbsize=960&pilicense=any&titles=${encodeURIComponent(title)}`,
      { headers: HEADERS },
    );
    if (!res.ok) return null;
    const data: {
      query?: { pages?: { thumbnail?: { source: string } }[] };
    } = await res.json();
    const source = data.query?.pages?.[0]?.thumbnail?.source;
    return source ? leadImage(lang, absolute(source)) : null;
  } catch {
    return null;
  }
}

// Without a representative image, a sole usable article image is a fallback.
// Multiple candidates are ambiguous: API file order and licence don't tell us
// which depicts the topic. Never treat a partial response as a sole candidate.
async function soleArticleImage(
  lang: LangCode,
  title: string,
): Promise<ItemImage | null> {
  try {
    const res = await wikiFetch(
      `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&generator=images&gimlimit=50&prop=imageinfo|categories&iiprop=url|size|mime&iiurlwidth=960&clcategories=${encodeURIComponent("Category:All free media")}&cllimit=max&titles=${encodeURIComponent(title)}`,
      { headers: HEADERS },
    );
    if (!res.ok) return null;
    const data: {
      continue?: Record<string, unknown>;
      query?: { pages?: ImagePage[] };
    } = await res.json();
    if (data.continue) return null;

    const candidates = (data.query?.pages ?? []).filter((page) => {
      const info = page.imageinfo?.[0];
      const width = info?.width ?? 0;
      const height = info?.height ?? 0;
      const ratio = height > 0 ? width / height : 0;
      return (
        !!(info?.thumburl ?? info?.url) &&
        !!info?.mime &&
        PICTURE_TYPES.has(info.mime) &&
        width >= 200 &&
        height >= 150 &&
        ratio >= 0.5 &&
        ratio <= 2.2 &&
        !PAGE_FURNITURE.test(page.title)
      );
    });
    if (candidates.length !== 1) return null;

    const page = candidates[0];
    const info = page.imageinfo?.[0];
    const source = info?.thumburl ?? info?.url;
    if (!source) return null;
    const url = absolute(source);
    return {
      url,
      nonFree: !fileIsFree(page),
      filePage:
        info?.descriptionurl ??
        filePageFor(lang, url, page.title.replace(/^[^:]+:/, "")),
    };
  } catch {
    return null;
  }
}

// Relevance comes before licence: use Wikipedia's representative image, then
// Wikidata's curated image, then a sole suitable article image. A free body
// image never replaces a lead.
async function chooseImage(
  lang: LangCode,
  qid: string,
  title: string,
  leadSource: string | undefined,
): Promise<ItemImage | null> {
  if (leadSource) return leadImage(lang, absolute(leadSource));

  const representative = await representativeImage(lang, title);
  if (representative) return representative;

  const fromWikidata = await wikidataImage(qid);
  if (fromWikidata) return { ...fromWikidata, nonFree: false };
  return soleArticleImage(lang, title);
}

// ---------------------------------------------------------------- lookups

// An article by its page key on one language's Wikipedia
export async function getItemByKey(
  key: string,
  lang: LangCode = DEFAULT_LANG,
  originalimage?: { source: string; width: number },
): Promise<LookupResult> {
  const res = await wikiFetch(
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`,
    { headers: HEADERS },
  );
  if (res.status === 429 || res.status >= 500) {
    return { error: "Wikipedia is busy right now. Try again in a minute." };
  }
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
    return {
      error: "That's a disambiguation page. Pick a more specific article.",
    };
  }
  if (data.type !== "standard")
    return { error: "That page can't be reviewed." };
  if (!data.wikibase_item) {
    return { error: "That article has no Wikidata entry." };
  }

  if (!ALLOW_PEOPLE && (await mightBeHuman(data.wikibase_item))) {
    return { error: "Articles about real people can't be reviewed." };
  }

  // The summary's thumbnail is only about 320px wide. Use a 960px version
  // when the original is big enough, otherwise the original as it is.
  const original = originalimage;
  let leadSource = data.thumbnail?.source;
  if (leadSource && original) {
    leadSource =
      original.width >= 960
        ? leadSource.replace(/\/\d+px-/, "/960px-")
        : original.source;
  }

  const image = await chooseImage(
    lang,
    data.wikibase_item,
    data.title,
    leadSource,
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
  const res = await wikiFetch(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=sitelinks&sitefilter=${encodeURIComponent(sites)}&format=json`,
    { headers: HEADERS },
  );
  if (!res.ok) return { error: "Couldn't reach Wikidata." };

  const data: {
    entities?: Record<
      string,
      { sitelinks?: Record<string, { title?: string }> }
    >;
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
// A random article from one language's Wikipedia. Tries a few, in case some
// can't be reviewed (disambiguation pages, no Wikidata entry).
export async function getRandomItem(
  lang: LangCode = DEFAULT_LANG,
): Promise<LookupResult> {
  const res = await wikiFetch(
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=5&format=json`,
    { headers: HEADERS },
  );
  if (!res.ok) {
    return { error: "Wikipedia is busy right now. Try again in a minute." };
  }

  const data: { query?: { random?: { title: string }[] } } = await res.json();
  for (const page of data.query?.random ?? []) {
    const result = await getItemByKey(page.title.replace(/ /g, "_"), lang);
    if ("item" in result) return result;
  }
  return { error: "Couldn't find a page this time. Try again." };
}

// The longest a visitor's request is held open to retry after a short wait
const MAX_RETRY_WAIT_MS = 3000;

let pausedUntil = 0;

// Waits out a short requested delay and retries once. After a longer delay it
// reports the failure, and sends nothing more from this server until it's over.
async function wikiFetch(url: string, _init?: RequestInit): Promise<Response> {
  if (Date.now() < pausedUntil) {
    console.warn("Wikimedia paused", url.slice(0, 120));
    return new Response(null, { status: 429 });
  }

  let res = await globalThis.fetch(url, { headers: HEADERS });
  let wait = requestedWaitMs(res);
  if (wait > 0 && wait <= MAX_RETRY_WAIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, wait));
    res = await globalThis.fetch(url, { headers: HEADERS });
    wait = requestedWaitMs(res);
  }
  pausedUntil = Math.max(pausedUntil, Date.now() + wait);

  if (!res.ok) console.warn("Wikimedia", res.status, url.slice(0, 120));
  return res;
}
