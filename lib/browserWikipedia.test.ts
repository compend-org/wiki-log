// ABOUTME: Tests reading Wikipedia search results and checking their pictures for explicit content.
// ABOUTME: Wikimedia's responses are stubbed.
import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import { explicitCommonsFiles, searchTitles } from "./browserWikipedia";

afterEach(() => mock.restoreAll());

test("search results keep Wikipedia's order and carry their Wikidata IDs", async () => {
  mock.method(globalThis, "fetch", async () =>
    Response.json({
      query: {
        pages: [
          { index: 2, title: "Vulvar cancer", pageprops: {} },
          {
            index: 1,
            title: "Vulva",
            description: "External female genitalia",
            pageprops: { wikibase_item: "Q2192288" },
            thumbnail: {
              source:
                "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Genital_Diversity_Expanded.jpg/60px-Genital_Diversity_Expanded.jpg",
            },
          },
          {
            index: 3,
            title: "Vulva (disambiguation)",
            pageprops: { wikibase_item: "Q1" },
          },
        ],
      },
    }),
  );

  assert.deepEqual(await searchTitles("vulva", "en"), [
    {
      key: "Vulva",
      wikidataId: "Q2192288",
      title: "Vulva",
      description: "External female genitalia",
      imageUrl:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Genital_Diversity_Expanded.jpg/60px-Genital_Diversity_Expanded.jpg",
    },
    {
      key: "Vulvar_cancer",
      wikidataId: null,
      title: "Vulvar cancer",
      description: null,
      imageUrl: null,
    },
  ]);
});

test("files under explicit categories are found, by the names they were asked by", async () => {
  const fetch = mock.method(globalThis, "fetch", async () =>
    Response.json({
      query: {
        pages: [
          {
            title: "File:Foreskin2.jpg",
            categories: [{ title: "Category:Human penis" }],
          },
          {
            title: "File:ALFiqh.png",
            categories: [{ title: "Category:Islamic jurisprudence" }],
          },
        ],
      },
    }),
  );

  assert.deepEqual(
    await explicitCommonsFiles(["foreskin2.jpg", "ALFiqh.png"]),
    new Set(["foreskin2.jpg"]),
  );
  const url = new URL(String(fetch.mock.calls[0].arguments[0]));
  assert.equal(
    url.searchParams.get("titles"),
    "File:Foreskin2.jpg|File:ALFiqh.png",
  );
});
