import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { getItemByKey } from "./wikipedia";

const cover =
  "https://upload.wikimedia.org/wikipedia/en/8/87/Steel_Ball_Run_1.jpg";
const portrait =
  "https://upload.wikimedia.org/wikipedia/commons/1/12/Hirohiko_Araki.jpg";
const filePage = "https://en.wikipedia.org/wiki/File:Steel_Ball_Run_1.jpg";

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
} = {}) {
  return mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request) => {
      const url = new URL(String(input));
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
        return Response.json({
          claims: {
            P18: wikidataFile
              ? [{ mainsnak: { datavalue: { value: wikidataFile } } }]
              : [],
          },
        });
      }
      if (url.hostname === "commons.wikimedia.org") {
        return Response.json({
          query: {
            pages: [
              { imageinfo: [{ thumburl: portrait, descriptionurl: portrait }] },
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

test("Steel Ball Run uses its non-free cover ahead of an author portrait", async () => {
  const fetch = mockWikipedia();
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.imageUrl, cover);
  assert.equal(result.item.imageNonFree, true);
  assert.equal(result.item.imageFilePage, filePage);
  assert.equal(fetch.mock.callCount(), 2);
});

test("a Commons lead stays free and needs no extra image lookup", async () => {
  const fetch = mockWikipedia({ lead: portrait });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.imageUrl, portrait);
  assert.equal(result.item.imageNonFree, false);
  assert.equal(fetch.mock.callCount(), 1);
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
  assert.equal(fetch.mock.callCount(), 4);
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

test("multiple substantive images stay ambiguous regardless of licence or order", async () => {
  const pages = [
    articlePicture("Steel_Ball_Run_1.jpg", cover),
    articlePicture("Hirohiko Araki.jpg", portrait, { free: true }),
  ];
  for (const bodyPages of [pages, [...pages].reverse()]) {
    mockWikipedia({ lead: null, wikidataFile: null, bodyPages });
    const result = await getItemByKey("Steel_Ball_Run");
    assert.ok("item" in result);
    assert.equal(result.item.imageUrl, null);
    mock.restoreAll();
  }
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

test("a partial image list is not mistaken for a single-image article", async () => {
  mockWikipedia({
    lead: null,
    wikidataFile: null,
    bodyPages: [articlePicture("Joni_Mitchell_in_blackface.png", joniImage)],
    bodyContinues: true,
  });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.imageUrl, null);
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
  assert.equal(fetch.mock.callCount(), 3);
});

test("a failed PageImages request still allows the sole article-image fallback", async () => {
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
