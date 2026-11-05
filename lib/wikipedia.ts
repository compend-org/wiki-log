// Item lookups on Wikipedia and Wikidata. Server-side only.

import { BUSY_ERROR, readSummary, summaryUrl } from "@/lib/articleSummary";
import { absolute, freeImage } from "@/lib/format";
import { DEFAULT_LANG, LANGUAGES, type LangCode } from "@/lib/languages";
import {
  type Pause,
  sendWithinDeadline,
  WAIT_BUDGET_MS,
} from "@/lib/wikimediaLimits";

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
  deadline: number,
): Promise<unknown[] | null> {
  try {
    const res = await wikiFetch(
      `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${qid}&property=${property}&format=json`,
      deadline,
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
async function mightBeHuman(qid: string, deadline: number): Promise<boolean> {
  const types = await getClaimValues(qid, "P31", deadline);
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
  deadline: number,
): Promise<{ url: string; filePage: string | null } | null> {
  try {
    const values = await getClaimValues(qid, "P18", deadline);
    const file = values?.find((v) => typeof v === "string") as
      | string
      | undefined;
    if (!file) return null;

    const res = await wikiFetch(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=960&titles=${encodeURIComponent(`File:${file}`)}`,
      deadline,
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
async function leadImage(
  lang: LangCode,
  url: string,
  deadline: number,
): Promise<ItemImage> {
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
      deadline,
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
  deadline: number,
): Promise<ItemImage | null> {
  try {
    const res = await wikiFetch(
      `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=pageimages&piprop=thumbnail&pithumbsize=960&pilicense=any&titles=${encodeURIComponent(title)}`,
      deadline,
    );
    if (!res.ok) return null;
    const data: {
      query?: { pages?: { thumbnail?: { source: string } }[] };
    } = await res.json();
    const source = data.query?.pages?.[0]?.thumbnail?.source;
    return source ? leadImage(lang, absolute(source), deadline) : null;
  } catch {
    return null;
  }
}

// Without a representative image, the first usable article image is a fallback.
// It may depict a related topic rather than the article's subject: API file
// order and licence don't tell us which image does.
async function firstArticleImage(
  lang: LangCode,
  title: string,
  deadline: number,
): Promise<ItemImage | null> {
  try {
    const res = await wikiFetch(
      `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&generator=images&gimlimit=50&prop=imageinfo|categories&iiprop=url|size|mime&iiurlwidth=960&clcategories=${encodeURIComponent("Category:All free media")}&cllimit=max&titles=${encodeURIComponent(title)}`,
      deadline,
    );
    if (!res.ok) return null;
    const data: {
      query?: { pages?: ImagePage[] };
    } = await res.json();

    const page = (data.query?.pages ?? []).find((page) => {
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
    if (!page) return null;

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
// Wikidata's curated image, then the first suitable article image. A free body
// image never replaces a lead.
async function chooseImage(
  lang: LangCode,
  qid: string,
  title: string,
  leadSource: string | undefined,
  deadline: number,
): Promise<ItemImage | null> {
  if (leadSource) return leadImage(lang, absolute(leadSource), deadline);

  const representative = await representativeImage(lang, title, deadline);
  if (representative) return representative;

  const fromWikidata = await wikidataImage(qid, deadline);
  if (fromWikidata) return { ...fromWikidata, nonFree: false };
  return firstArticleImage(lang, title, deadline);
}

// ---------------------------------------------------------------- lookups

// An article by its page key on one language's Wikipedia. While Wikimedia
// asks us to wait, keeps waiting until the deadline.
export async function getItemByKey(
  key: string,
  lang: LangCode = DEFAULT_LANG,
  originalimage?: { source: string; width: number },
  deadline: number = Date.now() + WAIT_BUDGET_MS,
): Promise<LookupResult> {
  const read = await readSummary(
    await wikiFetch(summaryUrl(lang, key), deadline),
  );
  if ("error" in read) return read;
  const data = read.summary;

  if (!ALLOW_PEOPLE && (await mightBeHuman(data.wikibase_item, deadline))) {
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
    deadline,
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
// article in any supported language. While Wikimedia asks us to wait, keeps
// waiting until the deadline.
export async function getItemById(
  qid: string,
  deadline: number = Date.now() + WAIT_BUDGET_MS,
): Promise<LookupResult> {
  if (!/^Q\d+$/.test(qid)) return { error: "Invalid item." };

  const sites = LANGUAGES.map((l) => `${l.code}wiki`).join("|");
  const res = await wikiFetch(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=sitelinks&sitefilter=${encodeURIComponent(sites)}&format=json`,
    deadline,
  );
  if (res.status === 429 || res.status >= 500) return { error: BUSY_ERROR };
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
    if (title) {
      return getItemByKey(title.replace(/ /g, "_"), code, undefined, deadline);
    }
  }

  return { error: "That item has no article in a supported language." };
}
// A random article from one language's Wikipedia. Tries a few, in case some
// can't be reviewed (disambiguation pages, no Wikidata entry).
export async function getRandomItem(
  lang: LangCode = DEFAULT_LANG,
  deadline: number = Date.now() + WAIT_BUDGET_MS,
): Promise<LookupResult> {
  const res = await wikiFetch(
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=5&format=json`,
    deadline,
  );
  if (!res.ok) return { error: BUSY_ERROR };

  const data: { query?: { random?: { title: string }[] } } = await res.json();
  for (const page of data.query?.random ?? []) {
    const result = await getItemByKey(
      page.title.replace(/ /g, "_"),
      lang,
      undefined,
      deadline,
    );
    if ("item" in result) return result;
  }
  return { error: "Couldn't find a page this time. Try again." };
}

// Waits Wikimedia has asked of this server, shared by every visitor's requests
const pause: Pause = { until: 0 };

// Waits out each delay Wikimedia asks for and retries, until the deadline.
// Running out of time or failing to connect is reported as a busy response.
async function wikiFetch(url: string, deadline: number): Promise<Response> {
  let res: Response | null;
  try {
    res = await sendWithinDeadline(
      // The request's own signal also stops Next.js reusing the first
      // response to a repeated GET while rendering a page, so a retry sends
      (signal) => globalThis.fetch(url, { headers: HEADERS, signal }),
      pause,
      deadline,
    );
  } catch (e) {
    console.warn("Wikimedia unreachable", url.slice(0, 120), e);
    return new Response(null, { status: 503 });
  }
  if (!res) {
    console.warn("Wikimedia out of time", url.slice(0, 120));
    return new Response(null, { status: 429 });
  }
  if (!res.ok) console.warn("Wikimedia", res.status, url.slice(0, 120));
  return res;
}
