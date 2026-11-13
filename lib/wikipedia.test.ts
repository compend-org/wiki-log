import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { BUSY_ERROR } from "./articleSummary";
import { getItemById, getItemByKey } from "./wikipedia";

const cover =
  "https://upload.wikimedia.org/wikipedia/en/8/87/Steel_Ball_Run_1.jpg";
const portrait =
  "https://upload.wikimedia.org/wikipedia/commons/1/12/Hirohiko_Araki.jpg";
const filePage = "https://en.wikipedia.org/wiki/File:Steel_Ball_Run_1.jpg";

const logo =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Deltarune_vector_logo.svg/960px-Deltarune_vector_logo.svg.png";

// English Wikipedia's list of explicit files, with one file on it
const explicitImage =
  "https://upload.wikimedia.org/wikipedia/commons/d/d7/Wiki-explicit_drawing.png";
const badImageList = `Explicit files may only be shown where listed.
* [[:File:Wiki-explicit drawing.png]] except on [[Example]]
`;

const joniImage =
  "https://upload.wikimedia.org/wikipedia/en/1/1c/Joni_Mitchell_in_blackface.png";

function articlePicture(
  fileName: string,
  url: string,
  {
    free = false,
    width = 365,
    height = 273,
    mime = "image/png",
  }: { free?: boolean; width?: number; height?: number; mime?: string } = {},
) {
  return {
    title: `File:${fileName}`,
    imagerepository: free ? "shared" : "local",
    imageinfo: [{ thumburl: url, width, height, mime }],
  };
}

function mockWikipedia({
  title = "Steel Ball Run",
  qid = "Q2738699",
  bodyPages = [] as ReturnType<typeof articlePicture>[],
  bodyContinues = false,
  bodyStatus = 200,
  representative = null as string | null,
  representativeStatus = 200,
  lead = cover,
  repository = "local",
  categories = [] as { title: string }[],
  metadataStatus = 200,
  metadataThrows = false,
  wikidataFile = "Hirohiko Araki.jpg" as string | null,
  wikidataLogo = null as string | null,
  instanceOf = "Q8274",
  genre = null as string | null,
  occupation = null as string | null,
  fileCategories = [] as string[],
}: {
  title?: string;
  qid?: string;
  bodyPages?: ReturnType<typeof articlePicture>[];
  bodyContinues?: boolean;
  bodyStatus?: number;
  representative?: string | null;
  representativeStatus?: number;
  lead?: string | null;
  repository?: string;
  categories?: { title: string }[];
  metadataStatus?: number;
  metadataThrows?: boolean;
  wikidataFile?: string | null;
  wikidataLogo?: string | null;
  instanceOf?: string;
  genre?: string | null;
  occupation?: string | null;
  // The categories of the chosen image's file
  fileCategories?: string[];
} = {}) {
  return mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === "/w/index.php") return new Response(badImageList);
      if (url.searchParams.get("prop") === "categories") {
        return Response.json({
          query: {
            pages: [{ categories: fileCategories.map((title) => ({ title })) }],
          },
        });
      }
      if (url.pathname.includes("/page/summary/")) {
        return Response.json({
          type: "standard",
          title,
          wikibase_item: qid,
          thumbnail: lead ? { source: lead } : undefined,
        });
      }
      if (url.searchParams.get("prop") === "pageimages") {
        assert.equal(url.searchParams.get("pilicense"), "any");
        assert.equal(url.searchParams.get("titles"), title);
        return Response.json(
          {
            query: {
              pages: [
                {
                  thumbnail: representative
                    ? { source: representative }
                    : undefined,
                },
              ],
            },
          },
          { status: representativeStatus },
        );
      }
      if (url.searchParams.get("action") === "wbgetclaims") {
        const ids: Record<string, string | null> = {
          P31: instanceOf,
          P136: genre,
          P106: occupation,
        };
        const asked = url.searchParams.get("property") as string;
        if (asked in ids) {
          const id = ids[asked];
          return Response.json({
            claims: {
              [asked]: id
                ? [{ mainsnak: { datavalue: { value: { id } } } }]
                : [],
            },
          });
        }
        const property = url.searchParams.get("property") as string;
        const file = property === "P154" ? wikidataLogo : wikidataFile;
        return Response.json({
          claims: {
            [property]: file
              ? [{ mainsnak: { datavalue: { value: file } } }]
              : [],
          },
        });
      }
      if (url.hostname === "commons.wikimedia.org") {
        const source =
          url.searchParams.get("titles") === `File:${wikidataLogo}`
            ? logo
            : portrait;
        return Response.json({
          query: {
            pages: [
              { imageinfo: [{ thumburl: source, descriptionurl: source }] },
            ],
          },
        });
      }
      if (url.searchParams.get("generator") === "images") {
        assert.equal(url.searchParams.get("titles"), title);
        return Response.json(
          {
            continue: bodyContinues ? { gimcontinue: "next" } : undefined,
            query: { pages: bodyPages },
          },
          { status: bodyStatus },
        );
      }
      assert.equal(url.searchParams.get("titles"), "File:Steel_Ball_Run_1.jpg");
      if (metadataThrows) throw new Error("Wikipedia unavailable");
      return Response.json(
        {
          query: {
            pages: [
              {
                title: "File:Steel Ball Run 1.jpg",
                imagerepository: repository,
                categories,
                imageinfo: [{ descriptionurl: filePage }],
              },
            ],
          },
        },
        { status: metadataStatus },
      );
    },
  );
}

afterEach(() => mock.restoreAll());

// How many requests were made to choose the image, not counting the ones that
// ask what the item is or whether it is adult content (those are made for
// every item, whatever its image)
function imageLookups(fetch: ReturnType<typeof mockWikipedia>): number {
  return fetch.mock.calls.filter((c) => {
    const url = new URL(String(c.arguments[0]));
    const property = url.searchParams.get("property") ?? "";
    return (
      !["P31", "P136", "P106"].includes(property) &&
      url.pathname !== "/w/index.php" &&
      url.searchParams.get("prop") !== "categories"
    );
  }).length;
}

test("an item records what Wikidata says it is an instance of", async () => {
  mockWikipedia();
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.deepEqual(result.item.types, ["Q8274"]);
});

test("an ordinary item with an ordinary image isn't adult content", async () => {
  mockWikipedia({ fileCategories: ["Category:Manga covers"] });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.nsfw, false);
});

test("an item whose genre is pornographic film is adult content", async () => {
  mockWikipedia({ genre: "Q185529" });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.nsfw, true);
});

test("a person whose occupation is pornographic film actor is adult content", async () => {
  mockWikipedia({ instanceOf: "Q5", occupation: "Q488111" });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.nsfw, true);
});

test("an image on Wikipedia's bad image list is adult content", async () => {
  mockWikipedia({ lead: explicitImage });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.imageUrl, explicitImage);
  assert.equal(result.item.nsfw, true);
});

test("an image filed under explicit categories is adult content", async () => {
  mockWikipedia({
    fileCategories: ["Category:Human sexual activity drawings"],
  });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.nsfw, true);
});

test("Steel Ball Run uses its non-free cover ahead of an author portrait", async () => {
  const fetch = mockWikipedia();
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.imageUrl, cover);
  assert.equal(result.item.imageNonFree, true);
  assert.equal(result.item.imageFilePage, filePage);
  assert.equal(imageLookups(fetch), 2);
});

test("a Commons lead stays free and needs no extra image lookup", async () => {
  const fetch = mockWikipedia({ lead: portrait });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.imageUrl, portrait);
  assert.equal(result.item.imageNonFree, false);
  assert.equal(imageLookups(fetch), 1);
});

test("a locally hosted lead marked as free retains its rights", async () => {
  mockWikipedia({ categories: [{ title: "Category:All free media" }] });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.imageUrl, cover);
  assert.equal(result.item.imageNonFree, false);
});

test("a local URL resolved to Commons is classified as free", async () => {
  mockWikipedia({ repository: "shared" });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.imageNonFree, false);
});

for (const failure of [{ metadataStatus: 404 }, { metadataThrows: true }]) {
  test(`a metadata failure preserves the lead and conservative rights: ${JSON.stringify(failure)}`, async () => {
    mockWikipedia(failure);
    const result = await getItemByKey("Steel_Ball_Run");
    assert.ok("item" in result);
    assert.equal(result.item.imageUrl, cover);
    assert.equal(result.item.imageNonFree, true);
    assert.equal(result.item.imageFilePage, filePage);
  });
}

test("Wikidata supplies a curated image when the article has no lead", async () => {
  mockWikipedia({ lead: null });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.imageUrl, portrait);
  assert.equal(result.item.imageNonFree, false);
});

test("no representative or suitable article image leaves the image empty", async () => {
  const fetch = mockWikipedia({ lead: null, wikidataFile: null });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.imageUrl, null);
  assert.equal(result.item.imageNonFree, false);
  assert.equal(result.item.imageFilePage, null);
  assert.equal(imageLookups(fetch), 5);
});

test("Wikidata's logo stands in when there is no lead or curated image", async () => {
  mockWikipedia({
    lead: null,
    wikidataFile: null,
    wikidataLogo: "Deltarune vector logo.svg",
    bodyPages: [articlePicture("Toby Fox 2017 (cropped 3).jpg", portrait)],
  });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.imageUrl, logo);
  assert.equal(result.item.imageNonFree, false);
  assert.equal(result.item.imageFilePage, logo);
});

test("Wikidata's curated image wins over its logo", async () => {
  mockWikipedia({ lead: null, wikidataLogo: "Deltarune vector logo.svg" });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.imageUrl, portrait);
});

test("the Joni Mitchell controversy can use its sole non-free body image", async () => {
  mockWikipedia({
    title: "Joni Mitchell blackface controversy",
    qid: "Q130329597",
    lead: null,
    wikidataFile: null,
    bodyPages: [
      articlePicture("Joni_Mitchell_in_blackface.png", joniImage),
      articlePicture("Ambox important.png", portrait, { free: true }),
    ],
  });
  const result = await getItemByKey("Joni_Mitchell_blackface_controversy");
  assert.ok("item" in result);
  assert.equal(result.item.id, "Q130329597");
  assert.equal(result.item.imageUrl, joniImage);
  assert.equal(result.item.imageNonFree, true);
  assert.equal(
    result.item.imageFilePage,
    "https://en.wikipedia.org/wiki/File:Joni_Mitchell_in_blackface.png",
  );
});

test("a sole Commons body image keeps its free classification", async () => {
  mockWikipedia({
    lead: null,
    wikidataFile: null,
    bodyPages: [articlePicture("Hirohiko Araki.jpg", portrait, { free: true })],
  });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.imageUrl, portrait);
  assert.equal(result.item.imageNonFree, false);
  assert.equal(
    result.item.imageFilePage,
    "https://commons.wikimedia.org/wiki/File:Hirohiko_Araki.jpg",
  );
});

test("multiple substantive images fall back to the first, regardless of licence", async () => {
  const pages = [
    articlePicture("Steel_Ball_Run_1.jpg", cover),
    articlePicture("Hirohiko Araki.jpg", portrait, { free: true }),
  ];
  for (const bodyPages of [pages, [...pages].reverse()]) {
    mockWikipedia({ lead: null, wikidataFile: null, bodyPages });
    const result = await getItemByKey("Steel_Ball_Run");
    assert.ok("item" in result);
    assert.equal(result.item.imageUrl, bodyPages[0].imageinfo[0].thumburl);
    mock.restoreAll();
  }
});

test("an unusable first image is skipped in favour of the next suitable one", async () => {
  mockWikipedia({
    lead: null,
    wikidataFile: null,
    bodyPages: [
      articlePicture("Wikiquote-logo.png", cover),
      articlePicture("Hirohiko Araki.jpg", portrait, { free: true }),
    ],
  });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.imageUrl, portrait);
});

test("small images, banners and unsupported formats are not body candidates", async () => {
  mockWikipedia({
    lead: null,
    wikidataFile: null,
    bodyPages: [
      articlePicture("Small.png", portrait, { width: 40, height: 40 }),
      articlePicture("Banner.png", portrait, { width: 1200, height: 200 }),
      articlePicture("Diagram.svg", portrait, { mime: "image/svg+xml" }),
    ],
  });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.imageUrl, null);
});

test("a partial image list can still supply the fallback", async () => {
  mockWikipedia({
    lead: null,
    wikidataFile: null,
    bodyPages: [articlePicture("Joni_Mitchell_in_blackface.png", joniImage)],
    bodyContinues: true,
  });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.imageUrl, joniImage);
});

test("a failed article-image lookup leaves the item usable without an image", async () => {
  mockWikipedia({ lead: null, wikidataFile: null, bodyStatus: 404 });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.imageUrl, null);
});

test("Wikipedia's representative image wins over a related Wikidata image when the summary has no thumbnail", async () => {
  const fetch = mockWikipedia({ lead: null, representative: cover });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.imageUrl, cover);
  assert.equal(result.item.imageNonFree, true);
  assert.equal(imageLookups(fetch), 3);
});

test("a failed PageImages request still allows the article-image fallback", async () => {
  mockWikipedia({
    lead: null,
    representativeStatus: 404,
    wikidataFile: null,
    bodyPages: [articlePicture("Joni_Mitchell_in_blackface.png", joniImage)],
  });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.imageUrl, joniImage);
});

// Refuses the first summary request, asking for a wait, then answers normally
function rateLimitFirstSummary(retryAfterSeconds: number) {
  mockWikipedia();
  const answer = globalThis.fetch;
  let refused = false;
  return mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request) => {
      if (!refused && String(input).includes("/page/summary/")) {
        refused = true;
        return new Response(null, {
          status: 429,
          headers: { "Retry-After": String(retryAfterSeconds) },
        });
      }
      return answer(input);
    },
  );
}

test("a rate-limited summary is retried after the requested wait", async () => {
  rateLimitFirstSummary(0.02);
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.title, "Steel Ball Run");
});

test("a wait past the deadline reports Wikipedia as busy", async () => {
  const fetch = rateLimitFirstSummary(0.02);
  const result = await getItemByKey(
    "Steel_Ball_Run",
    "en",
    undefined,
    Date.now() + 5,
  );
  assert.deepEqual(result, { error: BUSY_ERROR });
  assert.equal(imageLookups(fetch), 1);
});

test("a rate-limited Wikidata lookup reports Wikipedia as busy", async () => {
  mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(null, { status: 429, headers: { "Retry-After": "0.02" } }),
  );
  const result = await getItemById("Q2738699", Date.now() + 5);
  assert.deepEqual(result, { error: BUSY_ERROR });
});

test("a failed connection to Wikidata reports Wikipedia as busy", async () => {
  mock.method(globalThis, "fetch", async () => {
    throw new TypeError("fetch failed");
  });
  const result = await getItemById("Q2738699");
  assert.deepEqual(result, { error: BUSY_ERROR });
});
