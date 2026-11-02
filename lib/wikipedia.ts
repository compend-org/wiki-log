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

type ImageInfo = {
    thumburl?: string;
    width?: number;
    height?: number;
    mime?: string;
};

type ImagePage = {
    title: string;
    index?: number;
    imagerepository?: string;
    imageinfo?: ImageInfo[];
};

// File names that are almost always page furniture, not a picture of the topic
const JUNK =
    /(logo|icon|symbol|ambox|question[ _]book|commons-|wikimedia|wikipedia|wikidata|edit-clear|stub|portal|disambig|folder|nuvola|crystal|padlock|speaker|loudspeaker|red[ _]pencil|checkmark|ooui|ui-)/i;

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// A picture of the curated Wikidata "image" property (P18), which is always a
// Commons file
async function wikidataImage(qid: string): Promise<string | null> {
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
        return freeImage(data.query?.pages?.[0]?.imageinfo?.[0]?.thumburl);
    } catch {
        return null;
    }
}

// The first suitable picture in the article's own text
async function bodyImage(lang: LangCode, title: string): Promise<string | null> {
    try {
        const res = await fetch(
            `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&generator=images&gimlimit=50&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=330&titles=${encodeURIComponent(title)}`,
            { headers: HEADERS }
        );
        if (!res.ok) return null;
        const data: { query?: { pages?: ImagePage[] } } = await res.json();

        const candidates = (data.query?.pages ?? [])
            .filter((p) => {
                const info = p.imageinfo?.[0];
                if (!info || p.imagerepository !== "shared") return false; // Commons only
                if (!info.mime || !PHOTO_TYPES.has(info.mime)) return false;
                const w = info.width ?? 0;
                const h = info.height ?? 0;
                if (w < 200 || h < 150) return false;
                const ratio = w / h;
                if (ratio < 0.5 || ratio > 2.2) return false;
                return !JUNK.test(p.title);
            })
            .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

        for (const p of candidates) {
            const url = freeImage(p.imageinfo?.[0]?.thumburl);
            if (url) return url;
        }
        return null;
    } catch {
        return null;
    }
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

    // The lead image if there is a free one, then Wikidata's image for the
    // item, then the first suitable picture in the article's text
    let imageUrl = freeImage(data.thumbnail?.source);
    if (!imageUrl) imageUrl = await wikidataImage(data.wikibase_item);
    if (!imageUrl) imageUrl = await bodyImage(lang, data.title);

    return {
        item: {
            id: data.wikibase_item,
            title: data.title,
            description: data.description ?? null,
            imageUrl,
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