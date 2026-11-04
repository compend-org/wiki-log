import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { getItemByKey } from "./wikipedia";

const cover =
  "https://upload.wikimedia.org/wikipedia/en/8/87/Steel_Ball_Run_1.jpg";
const portrait =
  "https://upload.wikimedia.org/wikipedia/commons/1/12/Hirohiko_Araki.jpg";
const filePage = "https://en.wikipedia.org/wiki/File:Steel_Ball_Run_1.jpg";

function mockWikipedia({
  lead = cover,
  repository = "local",
  categories = [] as { title: string }[],
  metadataStatus = 200,
  metadataThrows = false,
  wikidataFile = "Hirohiko Araki.jpg" as string | null,
}: {
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
          title: "Steel Ball Run",
          wikibase_item: "Q2738699",
          thumbnail: lead ? { source: lead } : undefined,
        });
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
      // The old selector could find a free author portrait among body images.
      if (url.searchParams.get("generator") === "images") {
        return Response.json({
          query: {
            pages: [
              {
                title: "File:Hirohiko Araki.jpg",
                imagerepository: "shared",
                imageinfo: [
                  {
                    thumburl: portrait,
                    width: 500,
                    height: 650,
                    mime: "image/jpeg",
                  },
                ],
              },
            ],
          },
        });
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

test("without a lead or Wikidata image, unrelated body images are ignored", async () => {
  const fetch = mockWikipedia({ lead: null, wikidataFile: null });
  const result = await getItemByKey("Steel_Ball_Run");
  assert.ok("item" in result);
  assert.equal(result.item.imageUrl, null);
  assert.equal(result.item.imageNonFree, false);
  assert.equal(result.item.imageFilePage, null);
  assert.equal(fetch.mock.callCount(), 2);
});
