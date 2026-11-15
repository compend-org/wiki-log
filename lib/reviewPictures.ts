// ABOUTME: The pictures a review can show: its item's own picture and the free pictures in the item's Wikipedia article.
// ABOUTME: The same for every visitor, so each item's list is kept in the shared remote cache.
import { cacheLife } from "next/cache";
import { fileNameFromUrl } from "@/lib/format";
import { LANGUAGES, type LangCode } from "@/lib/languages";
import { createPublicClient } from "@/lib/supabase/public";
import { WAIT_BUDGET_MS } from "@/lib/wikipedia/wikimediaLimits";
import {
  articleImages,
  explicitImages,
  type ItemImage,
} from "@/lib/wikipedia/wikipedia";

export type PictureChoice = {
  url: string;
  // The page describing the file and its rights, for the picture's credit
  filePage: string | null;
  // The item's own picture, which a review shows unless its author picks another
  isDefault: boolean;
};

type ItemPictureRow = {
  image_url: string | null;
  image_hidden: boolean;
  image_page_url: string | null;
  page_url: string;
};

// The language and title of a Wikipedia article, read from its address
export function articleFromPageUrl(
  pageUrl: string,
): { lang: LangCode; title: string } | null {
  try {
    const url = new URL(pageUrl);
    const lang = LANGUAGES.find(
      (l) => url.hostname === `${l.code}.wikipedia.org`,
    )?.code;
    const key = url.pathname.match(/^\/wiki\/(.+)$/)?.[1];
    return lang && key ? { lang, title: decodeURIComponent(key) } : null;
  } catch {
    return null;
  }
}

// The item's picture first, then the article's free pictures that aren't
// explicit, in file name order. The article often shows the item's picture
// too, at another size, so each file is offered once.
export function toChoices(
  itemPicture: { url: string; filePage: string | null } | null,
  articlePictures: ItemImage[],
  explicit: Set<string>,
): PictureChoice[] {
  const seen = new Set<string>();
  const once = (url: string) => {
    const name = fileNameFromUrl(url) ?? url;
    if (seen.has(name)) return false;
    seen.add(name);
    return true;
  };

  const choices: PictureChoice[] = [];
  if (itemPicture && once(itemPicture.url)) {
    choices.push({ ...itemPicture, isDefault: true });
  }
  const others = articlePictures
    .filter((p) => !p.nonFree && !explicit.has(p.url))
    .sort((a, b) =>
      (fileNameFromUrl(a.url) ?? a.url).localeCompare(
        fileNameFromUrl(b.url) ?? b.url,
      ),
    );
  for (const p of others) {
    if (once(p.url)) {
      choices.push({ url: p.url, filePage: p.filePage, isDefault: false });
    }
  }
  return choices;
}

// The pictures a review of this item can show. Compounds and unknown items
// have none. Null if Wikipedia couldn't be reached, which is kept for only a
// minute so the next try asks again.
export async function pictureChoices(
  itemId: string,
): Promise<PictureChoice[] | null> {
  "use cache: remote";

  if (!/^Q\d+$/.test(itemId)) {
    cacheLife("days");
    return [];
  }

  const { data } = await createPublicClient()
    .from("items")
    .select("image_url, image_hidden, image_page_url, page_url")
    .eq("id", itemId)
    .maybeSingle();
  const row = data as ItemPictureRow | null;
  const article = row ? articleFromPageUrl(row.page_url) : null;
  if (!row || !article) {
    // An item can be saved moments after someone first looks for it
    cacheLife({ stale: 30, revalidate: 60, expire: 60 });
    return [];
  }

  const deadline = Date.now() + WAIT_BUDGET_MS;
  const pictures = await articleImages(article.lang, article.title, deadline);
  if (!pictures) {
    cacheLife({ stale: 30, revalidate: 60, expire: 60 });
    return null;
  }
  const explicit = await explicitImages(
    pictures.filter((p) => !p.nonFree).map((p) => p.url),
    deadline,
  );

  // Articles change slowly
  cacheLife("days");
  const itemPicture =
    row.image_url && !row.image_hidden
      ? { url: row.image_url, filePage: row.image_page_url }
      : null;
  return toChoices(itemPicture, pictures, explicit);
}

// The picture to store for a review: null for the item's own picture, the
// address for one of the article's pictures, or an error for anything else
export async function storedPicture(
  itemId: string,
  url: string | null,
): Promise<{ url: string | null } | { error: string }> {
  if (url === null) return { url: null };
  if (typeof url !== "string") return { error: "Invalid picture." };

  const choices = await pictureChoices(itemId);
  if (!choices) {
    return { error: "Couldn't reach Wikipedia. Try again in a minute." };
  }
  const choice = choices.find((c) => c.url === url);
  if (!choice) return { error: "That picture isn't available." };
  return { url: choice.isDefault ? null : choice.url };
}
