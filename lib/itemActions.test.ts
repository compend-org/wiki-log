// ABOUTME: Exercises item-saving actions against mocked Supabase and Wikimedia HTTP.
// ABOUTME: Checks that references use the stored ID when Wikipedia resolves another ID.
import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import nextCache from "next/cache";
import headers from "next/headers";
import server from "next/server";
import {
  addToList,
  createCompound,
  createList,
  itemPictureChoices,
  logItem,
  reportBrokenImage,
  setFavourite,
  setFavouritePicture,
  setListItemPicture,
  setReviewPicture,
} from "../app/actions";
import ItemPage, { generateMetadata } from "../app/item/[id]/page";
import { FEATURES } from "./features";
import { getItemForPage } from "./items";

const requestedId = "Q235858";
const resolvedId = "Q43343";
const userId = "11111111-1111-4111-8111-111111111111";
const listId = "22222222-2222-4222-8222-222222222222";
const title = "Traditional folk music";
const imageUrl = "https://upload.wikimedia.org/wikipedia/commons/a/ab/Folk.jpg";
const renamedImageUrl =
  "https://upload.wikimedia.org/wikipedia/commons/c/cd/Folk_old_name.jpg";
// A picture further down the item's article, which a review may choose
const articleImageUrl =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Fiddle.jpg/960px-Fiddle.jpg";
const pageUrl = "https://en.wikipedia.org/wiki/Traditional_folk_music";
const logId = "33333333-3333-4333-8333-333333333333";

type Row = {
  id: string;
  fetched_at?: string;
  title: string;
  image_url: string | null;
  image_hidden?: boolean;
  page_url?: string;
};
type Review = {
  id: string;
  user_id: string;
  item_id: string;
  image_url: string | null;
};
// An item in a list, and who owns the list
type ListEntry = {
  item_id: string;
  owner: string;
  image_url: string | null;
};
// An item in someone's top 5
type FavouriteSlot = {
  user_id: string;
  position: number;
  item_id: string;
  image_url: string | null;
};
type Write = {
  table: string;
  body: Record<string, unknown>;
  method: string;
  id?: string;
};

function setup({
  cached = [] as Row[],
  lastPosition = null as number | null,
  listCheckFails = false,
  lookupFails = false,
  upsertFails = false,
  writeFails = false,
  imageStatus = 200,
  reviews = [] as Review[],
  suspended = false,
  pictureWriteFails = false,
  listEntries = [] as ListEntry[],
  favourites = [] as FavouriteSlot[],
  undoFails = false,
} = {}) {
  const previousEnv = { ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
  process.env.SUPABASE_SECRET_KEY = "test-secret-key";
  const compounds = FEATURES.compounds;
  FEATURES.compounds = true;
  mock.method(server, "connection", async () => {});
  mock.method(nextCache, "cacheLife", () => {});
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const claims = [
    { alg: "HS256", typ: "JWT" },
    { sub: userId, exp: expires, aud: "authenticated" },
  ]
    .map((part) => Buffer.from(JSON.stringify(part)).toString("base64url"))
    .join(".");
  const token = `${claims}.c2lnbmF0dXJl`;
  mock.method(
    headers,
    "cookies",
    async () =>
      ({
        getAll: () => [
          {
            name: "sb-test-auth-token",
            value: JSON.stringify({
              access_token: token,
              refresh_token: "test-refresh",
              expires_at: expires,
              user: { id: userId },
            }),
          },
        ],
        set: () => {},
      }) as unknown as Awaited<ReturnType<typeof headers.cookies>>,
  );
  const items = new Map(cached.map((row) => [row.id, row]));
  const writes: Write[] = [];
  const imageChecks: string[] = [];
  let lookups = 0;
  mock.method(
    globalThis,
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.hostname === "test.supabase.co") {
        if (url.pathname === "/auth/v1/user")
          return Response.json({ id: userId });
        const table = url.pathname.replace("/rest/v1/", "");
        if (init?.method === "DELETE") {
          const id = url.searchParams.get("id")?.replace(/^eq\./, "");
          writes.push({ table, body: {}, method: init.method, id });
          if (undoFails)
            return Response.json(
              { code: "57014", message: "Statement timeout" },
              { status: 500 },
            );
          return new Response(null, { status: 204 });
        }
        if (init?.method === "POST" || init?.method === "PATCH") {
          const body = JSON.parse(String(init.body)) as Record<string, unknown>;
          const id = url.searchParams.get("id")?.replace(/^eq\./, "");
          writes.push({ table, body, method: init.method, id });
          if (table === "items") {
            if (upsertFails)
              return Response.json(
                { code: "42501", message: "Item storage denied" },
                { status: 403 },
              );
            const rowId = String(body.id ?? id);
            if (init.method === "PATCH") assert.ok(items.has(rowId));
            items.set(rowId, { ...items.get(rowId), ...body } as Row);
          } else if (table === "logs" && init.method === "PATCH") {
            // Only the server changes a review's picture
            assert.deepEqual(Object.keys(body), ["image_url"]);
            if (pictureWriteFails)
              return Response.json(
                { code: "57014", message: "Statement timeout" },
                { status: 500 },
              );
            return new Response(null, { status: 204 });
          } else if (
            ["list_items", "favourites"].includes(table) &&
            init.method === "PATCH"
          ) {
            // Only the server changes a list entry's or slot's picture
            assert.deepEqual(Object.keys(body), ["image_url"]);
            if (pictureWriteFails)
              return Response.json(
                { code: "57014", message: "Statement timeout" },
                { status: 500 },
              );
            if (table === "favourites") {
              const filter = (column: string) =>
                url.searchParams.get(column)?.replace(/^eq\./, "");
              return Response.json(
                favourites
                  .filter(
                    (f) =>
                      filter("user_id") === f.user_id &&
                      filter("position") === String(f.position) &&
                      filter("item_id") === f.item_id,
                  )
                  .map((f) => ({ position: f.position })),
              );
            }
            return new Response(null, { status: 204 });
          } else if (table === "lists") {
            return Response.json({ id: listId }, { status: 201 });
          } else if (["logs", "favourites", "list_items"].includes(table)) {
            // Model the FK that failed in production, rather than accepting any ID.
            const rows = Array.isArray(body) ? body : [body];
            if (!rows.every((row) => items.has(String(row.item_id))))
              return Response.json(
                { code: "23503", message: "Item does not exist" },
                { status: 409 },
              );
            if (writeFails)
              return Response.json(
                { code: "42501", message: "Write denied" },
                { status: 403 },
              );
            if (table === "logs") {
              return Response.json([{ id: logId }], { status: 201 });
            }
          } else if (table === "rpc/create_compound") {
            assert.ok((body.p_parts as string[]).every((id) => items.has(id)));
            return Response.json({ id: "C1", title: "Music", existing: false });
          } else {
            assert.equal(table, "rpc/move_list_item");
          }
          return new Response(null, { status: 201 });
        }
        const filter = (column: string) =>
          url.searchParams.get(column)?.replace(/^eq\./, "");
        if (table === "logs") {
          return Response.json(
            reviews
              .filter(
                (r) =>
                  (filter("id") ?? r.id) === r.id &&
                  (filter("user_id") ?? r.user_id) === r.user_id &&
                  (filter("image_url") ?? r.image_url) === r.image_url,
              )
              .map((r) => ({ ...r, items: items.get(r.item_id) ?? null })),
          );
        }
        if (table === "favourites") {
          return Response.json(
            favourites.filter(
              (f) =>
                (filter("user_id") ?? f.user_id) === f.user_id &&
                (filter("position") ?? String(f.position)) ===
                  String(f.position) &&
                (filter("image_url") ?? f.image_url) === f.image_url,
            ),
          );
        }
        if (table === "profiles") {
          return Response.json([
            {
              banned_at: null,
              account_restrictions: suspended
                ? {
                    suspended_until: new Date(
                      Date.now() + 86400000,
                    ).toISOString(),
                  }
                : null,
            },
          ]);
        }
        if (table === "items") {
          const image = url.searchParams.get("image_url")?.replace(/^eq\./, "");
          if (image !== undefined) {
            return Response.json(
              [...items.values()].filter((row) => row.image_url === image),
            );
          }
          const item = items.get(
            url.searchParams.get("id")?.replace(/^eq\./, "") ?? "",
          );
          return Response.json(item ? [item] : []);
        }
        if (table === "lists") {
          if (listCheckFails) return new Response("timeout", { status: 555 });
          return Response.json([{ id: listId }]);
        }
        assert.equal(table, "list_items");
        if (url.searchParams.has("lists.user_id") || filter("image_url")) {
          return Response.json(
            listEntries
              .filter(
                (e) =>
                  (filter("item_id") ?? e.item_id) === e.item_id &&
                  (filter("lists.user_id") ?? e.owner) === e.owner &&
                  (filter("image_url") ?? e.image_url) === e.image_url,
              )
              .map((e) => ({
                list_id: listId,
                item_id: e.item_id,
                lists: { user_id: e.owner },
              })),
          );
        }
        return Response.json(
          lastPosition === null ? [] : [{ position: lastPosition }],
        );
      }
      if (init?.method === "HEAD") {
        imageChecks.push(url.href);
        return new Response(null, { status: imageStatus });
      }
      if (url.searchParams.get("action") === "wbgetentities") {
        lookups++;
        if (lookupFails) return new Response(null, { status: 404 });
        const id = url.searchParams.get("ids") as string;
        return Response.json({
          entities: { [id]: { sitelinks: { enwiki: { title } } } },
        });
      }
      // The bad image list, and the categories of the article's files
      if (url.pathname === "/w/index.php") return new Response("");
      if (url.searchParams.get("prop") === "categories") {
        return Response.json({
          query: {
            pages: (url.searchParams.get("titles") ?? "")
              .split("|")
              .map((title) => ({ title, categories: [] })),
          },
        });
      }
      if (url.searchParams.get("generator") === "images") {
        assert.equal(url.searchParams.get("titles"), "Traditional_folk_music");
        return Response.json({
          query: {
            pages: [
              {
                title: "File:Fiddle.jpg",
                imagerepository: "shared",
                imageinfo: [
                  {
                    thumburl: articleImageUrl,
                    width: 800,
                    height: 600,
                    mime: "image/jpeg",
                  },
                ],
              },
            ],
          },
        });
      }
      if (url.pathname.includes("/page/summary/")) {
        return Response.json({
          type: "standard",
          title,
          wikibase_item: resolvedId,
          thumbnail: { source: imageUrl },
        });
      }
      assert.equal(url.searchParams.get("action"), "wbgetclaims");
      assert.equal(url.searchParams.get("entity"), resolvedId);
      return Response.json({ claims: { P31: [] } });
    },
  );
  return {
    writes,
    imageChecks,
    lookups: () => lookups,
    restore: () => {
      FEATURES.compounds = compounds;
      for (const key of [
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_SECRET_KEY",
      ]) {
        if (previousEnv[key] === undefined) delete process.env[key];
        else process.env[key] = previousEnv[key];
      }
    },
  };
}

let fixture: ReturnType<typeof setup> | undefined;
afterEach(() => {
  mock.restoreAll();
  fixture?.restore();
  fixture = undefined;
});

test("logging a requested ID stores and references the resolved Wikipedia ID", async () => {
  fixture = setup();
  assert.deepEqual(
    await logItem({ itemId: requestedId, rating: 4, review: "Good" }),
    {},
  );
  assert.deepEqual(
    fixture.writes.map(({ table }) => table),
    ["items", "logs"],
  );
  assert.equal(fixture.writes[0].body.id, resolvedId);
  assert.equal(fixture.writes[1].body.item_id, resolvedId);
});

test("logging with a picture from the article saves it on the new entry", async () => {
  fixture = setup();
  assert.deepEqual(
    await logItem({
      itemId: requestedId,
      rating: 4,
      review: "",
      imageUrl: articleImageUrl,
    }),
    {},
  );
  const logWrites = fixture.writes.filter((w) => w.table === "logs");
  assert.deepEqual(
    logWrites.map((w) => w.method),
    ["POST", "PATCH"],
  );
  assert.equal(logWrites[0].body.image_url, undefined);
  assert.equal(logWrites[1].id, logId);
  assert.equal(logWrites[1].body.image_url, articleImageUrl);
});

test("an entry whose picture can't be saved is taken back out, so trying again can't log it twice", async () => {
  fixture = setup({ pictureWriteFails: true });
  assert.deepEqual(
    await logItem({
      itemId: requestedId,
      rating: 4,
      review: "",
      imageUrl: articleImageUrl,
    }),
    { error: "Couldn't save your entry. Try again." },
  );
  const logWrites = fixture.writes.filter((w) => w.table === "logs");
  assert.deepEqual(
    logWrites.map((w) => [w.method, w.id]),
    [
      ["POST", undefined],
      ["PATCH", logId],
      ["DELETE", logId],
    ],
  );
});

test("an item nobody has saved yet offers its article's pictures", async () => {
  fixture = setup();
  const result = await itemPictureChoices(resolvedId);
  assert.ok("choices" in result);
  assert.deepEqual(
    result.choices.map((c) => [c.url, c.isDefault]),
    [
      [imageUrl, true],
      [articleImageUrl, false],
    ],
  );
  assert.equal(
    fixture.writes.some((w) => w.table === "items"),
    false,
  );
});

test("logging with the item's own picture stores no picture of its own", async () => {
  fixture = setup();
  assert.deepEqual(
    await logItem({
      itemId: requestedId,
      rating: 4,
      review: "",
      imageUrl,
    }),
    {},
  );
  assert.deepEqual(
    fixture.writes.filter((w) => w.table === "logs").map((w) => w.method),
    ["POST"],
  );
});

test("logging with a picture that isn't in the article saves nothing", async () => {
  fixture = setup();
  assert.deepEqual(
    await logItem({
      itemId: requestedId,
      rating: 4,
      review: "",
      imageUrl:
        "https://upload.wikimedia.org/wikipedia/commons/a/aa/Elsewhere.jpg",
    }),
    { error: "That picture isn't available." },
  );
  assert.equal(
    fixture.writes.some((w) => w.table === "logs"),
    false,
  );
});

const folkItem = {
  id: resolvedId,
  title,
  image_url: imageUrl,
  page_url: pageUrl,
  fetched_at: new Date().toISOString(),
};

test("a review's author can change its picture to one from the article", async () => {
  fixture = setup({
    cached: [folkItem],
    reviews: [
      { id: logId, user_id: userId, item_id: resolvedId, image_url: null },
    ],
  });
  assert.deepEqual(await setReviewPicture(logId, articleImageUrl), {});
  const write = fixture.writes.find((w) => w.table === "logs");
  assert.equal(write?.method, "PATCH");
  assert.equal(write?.id, logId);
  assert.equal(write?.body.image_url, articleImageUrl);
});

test("a review goes back to its item's picture", async () => {
  fixture = setup({
    cached: [folkItem],
    reviews: [
      {
        id: logId,
        user_id: userId,
        item_id: resolvedId,
        image_url: articleImageUrl,
      },
    ],
  });
  assert.deepEqual(await setReviewPicture(logId, null), {});
  assert.equal(
    fixture.writes.find((w) => w.table === "logs")?.body.image_url,
    null,
  );
});

test("someone else's review keeps its picture", async () => {
  fixture = setup({
    cached: [folkItem],
    reviews: [
      {
        id: logId,
        user_id: "44444444-4444-4444-8444-444444444444",
        item_id: resolvedId,
        image_url: null,
      },
    ],
  });
  assert.deepEqual(await setReviewPicture(logId, articleImageUrl), {
    error: "Couldn't save that change.",
  });
  assert.deepEqual(fixture.writes, []);
});

test("a suspended account can't change a review's picture", async () => {
  fixture = setup({
    cached: [folkItem],
    reviews: [
      { id: logId, user_id: userId, item_id: resolvedId, image_url: null },
    ],
    suspended: true,
  });
  assert.deepEqual(await setReviewPicture(logId, articleImageUrl), {
    error: "Your account is suspended",
  });
  assert.deepEqual(fixture.writes, []);
});

test("a list's owner can change an item's picture to one from the article", async () => {
  fixture = setup({
    cached: [folkItem],
    listEntries: [{ item_id: resolvedId, owner: userId, image_url: null }],
  });
  assert.deepEqual(
    await setListItemPicture(listId, resolvedId, articleImageUrl),
    {},
  );
  const write = fixture.writes.find((w) => w.table === "list_items");
  assert.equal(write?.method, "PATCH");
  assert.equal(write?.body.image_url, articleImageUrl);
});

test("an item in a list goes back to its own picture", async () => {
  fixture = setup({
    cached: [folkItem],
    listEntries: [
      { item_id: resolvedId, owner: userId, image_url: articleImageUrl },
    ],
  });
  assert.deepEqual(await setListItemPicture(listId, resolvedId, null), {});
  assert.equal(
    fixture.writes.find((w) => w.table === "list_items")?.body.image_url,
    null,
  );
});

test("someone else's list keeps its pictures", async () => {
  fixture = setup({
    cached: [folkItem],
    listEntries: [
      {
        item_id: resolvedId,
        owner: "44444444-4444-4444-8444-444444444444",
        image_url: null,
      },
    ],
  });
  assert.deepEqual(
    await setListItemPicture(listId, resolvedId, articleImageUrl),
    { error: "Couldn't save that change." },
  );
  assert.deepEqual(fixture.writes, []);
});

test("a picture that isn't in the item's article isn't saved in a list", async () => {
  fixture = setup({
    cached: [folkItem],
    listEntries: [{ item_id: resolvedId, owner: userId, image_url: null }],
  });
  assert.deepEqual(
    await setListItemPicture(
      listId,
      resolvedId,
      "https://upload.wikimedia.org/wikipedia/commons/a/aa/Elsewhere.jpg",
    ),
    { error: "That picture isn't available." },
  );
  assert.deepEqual(fixture.writes, []);
});

test("a suspended account can't change a picture in a list", async () => {
  fixture = setup({
    cached: [folkItem],
    listEntries: [{ item_id: resolvedId, owner: userId, image_url: null }],
    suspended: true,
  });
  assert.deepEqual(
    await setListItemPicture(listId, resolvedId, articleImageUrl),
    { error: "Your account is suspended" },
  );
  assert.deepEqual(fixture.writes, []);
});

test("a top 5 slot can show a picture from its item's article", async () => {
  fixture = setup({
    cached: [folkItem],
    favourites: [
      { user_id: userId, position: 2, item_id: resolvedId, image_url: null },
    ],
  });
  assert.deepEqual(
    await setFavouritePicture(2, resolvedId, articleImageUrl),
    {},
  );
  const write = fixture.writes.find((w) => w.table === "favourites");
  assert.equal(write?.method, "PATCH");
  assert.equal(write?.body.image_url, articleImageUrl);
});

test("a top 5 slot goes back to its item's own picture", async () => {
  fixture = setup({
    cached: [folkItem],
    favourites: [
      {
        user_id: userId,
        position: 2,
        item_id: resolvedId,
        image_url: articleImageUrl,
      },
    ],
  });
  assert.deepEqual(await setFavouritePicture(2, resolvedId, null), {});
  assert.equal(
    fixture.writes.find((w) => w.table === "favourites")?.body.image_url,
    null,
  );
});

test("a picture picked before the slot was given another item isn't saved there", async () => {
  fixture = setup({
    cached: [folkItem],
    favourites: [
      {
        user_id: userId,
        position: 2,
        item_id: "Q2",
        image_url: articleImageUrl,
      },
    ],
  });
  // Picked for the item the slot used to hold, in a page opened earlier
  assert.deepEqual(await setFavouritePicture(2, resolvedId, null), {
    error: "That slot has changed. Reload the page to see it.",
  });
});

test("someone else's top 5 slot keeps its picture", async () => {
  fixture = setup({
    cached: [folkItem],
    favourites: [
      {
        user_id: "44444444-4444-4444-8444-444444444444",
        position: 2,
        item_id: resolvedId,
        image_url: null,
      },
    ],
  });
  assert.deepEqual(await setFavouritePicture(2, resolvedId, articleImageUrl), {
    error: "That slot has changed. Reload the page to see it.",
  });
});

test("a top 5 slot only shows pictures from its item's article", async () => {
  fixture = setup({
    cached: [folkItem],
    favourites: [
      { user_id: userId, position: 2, item_id: resolvedId, image_url: null },
    ],
  });
  assert.deepEqual(
    await setFavouritePicture(
      2,
      resolvedId,
      "https://upload.wikimedia.org/wikipedia/commons/a/aa/Elsewhere.jpg",
    ),
    { error: "That picture isn't available." },
  );
  assert.deepEqual(fixture.writes, []);
});

const newList = { title: "Folk", description: "", ranked: false };

test("creating a list saves the pictures picked for its items", async () => {
  fixture = setup({ cached: [folkItem] });
  assert.deepEqual(
    await createList({
      ...newList,
      itemIds: [resolvedId],
      pictures: { [resolvedId]: articleImageUrl },
    }),
    { id: listId },
  );
  const entryWrites = fixture.writes.filter((w) => w.table === "list_items");
  assert.deepEqual(
    entryWrites.map((w) => w.method),
    ["POST", "PATCH"],
  );
  assert.equal(
    (entryWrites[0].body as unknown as { image_url?: string }[])[0].image_url,
    undefined,
  );
  assert.equal(entryWrites[1].body.image_url, articleImageUrl);
});

test("creating a list with a picture that isn't in the article saves nothing", async () => {
  fixture = setup({ cached: [folkItem] });
  assert.deepEqual(
    await createList({
      ...newList,
      itemIds: [resolvedId],
      pictures: {
        [resolvedId]:
          "https://upload.wikimedia.org/wikipedia/commons/a/aa/Elsewhere.jpg",
      },
    }),
    { error: "That picture isn't available." },
  );
  assert.deepEqual(fixture.writes, []);
});

test("a picture for an item that isn't in the new list is refused", async () => {
  fixture = setup({ cached: [folkItem] });
  assert.deepEqual(
    await createList({
      ...newList,
      itemIds: [resolvedId],
      pictures: { Q1: articleImageUrl },
    }),
    { error: "Invalid pictures." },
  );
  assert.deepEqual(fixture.writes, []);
});

test("a list whose pictures can't be saved is taken back out, so trying again can't create it twice", async () => {
  fixture = setup({ cached: [folkItem], pictureWriteFails: true });
  assert.deepEqual(
    await createList({
      ...newList,
      itemIds: [resolvedId],
      pictures: { [resolvedId]: articleImageUrl },
    }),
    { error: "Couldn't create the list. Try again." },
  );
  assert.deepEqual(fixture.writes.at(-1), {
    table: "lists",
    body: {},
    method: "DELETE",
    id: listId,
  });
});

test("a list that can't be taken back out after its pictures failed says it was created", async () => {
  fixture = setup({
    cached: [folkItem],
    pictureWriteFails: true,
    undoFails: true,
  });
  assert.deepEqual(
    await createList({
      ...newList,
      itemIds: [resolvedId],
      pictures: { [resolvedId]: articleImageUrl },
    }),
    { error: "Your list was created, but not all its pictures." },
  );
});

test("adding to a ranked list uses the resolved ID in the row, move and response", async () => {
  fixture = setup({ lastPosition: 2 });
  assert.deepEqual(
    await addToList({ listId, itemId: requestedId, position: 2 }),
    { item: { itemId: resolvedId, title, imageUrl } },
  );
  assert.equal(
    fixture.writes.find((w) => w.table === "list_items")?.body.item_id,
    resolvedId,
  );
  assert.deepEqual(
    fixture.writes.find((w) => w.table === "rpc/move_list_item")?.body,
    { p_list: listId, p_item: resolvedId, p_position: 2 },
  );
});

test("a ranked list past the old 100-item cap takes a placed item", async () => {
  fixture = setup({ lastPosition: 5000 });
  assert.deepEqual(
    await addToList({ listId, itemId: requestedId, position: 1 }),
    { item: { itemId: resolvedId, title, imageUrl } },
  );
  assert.equal(
    fixture.writes.find((w) => w.table === "list_items")?.body.position,
    5001,
  );
  assert.deepEqual(
    fixture.writes.find((w) => w.table === "rpc/move_list_item")?.body,
    { p_list: listId, p_item: resolvedId, p_position: 1 },
  );
});

test("placing an item last doesn't move anything", async () => {
  fixture = setup({ lastPosition: 150 });
  assert.deepEqual(
    await addToList({ listId, itemId: requestedId, position: 151 }),
    { item: { itemId: resolvedId, title, imageUrl } },
  );
  assert.deepEqual(
    fixture.writes.map(({ table }) => table),
    ["items", "list_items"],
  );
});

test("positions outside a list's possible range are rejected", async () => {
  fixture = setup();
  for (const position of [0, -1, 1.5, Number.NaN, 10001]) {
    assert.deepEqual(
      await addToList({ listId, itemId: requestedId, position }),
      { error: "Invalid position." },
    );
  }
  assert.deepEqual(fixture.writes, []);
});

test("a failed list check isn't reported as someone else's list", async () => {
  fixture = setup({ listCheckFails: true });
  assert.deepEqual(await addToList({ listId, itemId: requestedId }), {
    error: "Couldn't add to that list. Please try again.",
  });
  assert.deepEqual(fixture.writes, []);
});

test("favourites reference the resolved ID", async () => {
  fixture = setup();
  assert.deepEqual(
    await setFavourite({ position: 1, itemId: requestedId }),
    {},
  );
  assert.equal(
    fixture.writes.find((w) => w.table === "favourites")?.body.item_id,
    resolvedId,
  );
});

test("compound ingredients use resolved IDs and preserve their order", async () => {
  fixture = setup({ cached: [{ id: "C2", title: "Other", image_url: null }] });
  assert.deepEqual(
    await createCompound({
      title: "Music",
      description: "",
      parts: [requestedId, "C2"],
    }),
    { id: "C1" },
  );
  assert.deepEqual(
    fixture.writes.find((w) => w.table === "rpc/create_compound")?.body.p_parts,
    [resolvedId, "C2"],
  );
});

test("compound aliases resolving to the same ingredient are rejected before the RPC", async () => {
  fixture = setup();
  assert.deepEqual(
    await createCompound({
      title: "Music",
      description: "",
      parts: [requestedId, resolvedId],
    }),
    { error: "Each ingredient can only be used once." },
  );
  assert.ok(!fixture.writes.some((w) => w.table === "rpc/create_compound"));
});

for (const mode of ["fresh", "stale", "compound"] as const) {
  test(`${mode} cached items retain their stored ID`, async () => {
    const itemId = mode === "compound" ? "C2" : requestedId;
    fixture = setup({
      cached: [
        {
          id: itemId,
          title,
          image_url: imageUrl,
          fetched_at: new Date(mode === "stale" ? 0 : Date.now()).toISOString(),
        },
      ],
      lookupFails: true,
    });
    assert.deepEqual(await logItem({ itemId, rating: null, review: "" }), {});
    assert.equal(fixture.writes[0].body.item_id, itemId);
    assert.equal(fixture.lookups(), mode === "stale" ? 1 : 0);
  });
}

test("a successful stale refresh references the newly stored resolved ID", async () => {
  fixture = setup({
    cached: [
      {
        id: requestedId,
        title,
        image_url: imageUrl,
        fetched_at: new Date(0).toISOString(),
      },
    ],
  });
  assert.deepEqual(
    await logItem({ itemId: requestedId, rating: null, review: "" }),
    {},
  );
  assert.equal(
    fixture.writes.find((w) => w.table === "logs")?.body.item_id,
    resolvedId,
  );
});

const renamedImageItem = {
  id: resolvedId,
  title,
  image_url: renamedImageUrl,
  image_hidden: false,
  fetched_at: new Date().toISOString(),
};

test("an image Wikimedia no longer has is replaced by refreshing its item", async () => {
  fixture = setup({ cached: [renamedImageItem], imageStatus: 404 });
  assert.equal(await reportBrokenImage(renamedImageUrl), imageUrl);
  assert.deepEqual(fixture.imageChecks, [renamedImageUrl]);
  const write = fixture.writes.find((w) => w.table === "items");
  assert.equal(write?.method, "PATCH");
  assert.equal(write?.id, resolvedId);
  assert.equal(write?.body.image_url, imageUrl);
});

test("a review whose chosen picture is gone goes back to its item's picture", async () => {
  fixture = setup({
    cached: [{ ...folkItem, image_hidden: false }],
    reviews: [
      {
        id: logId,
        user_id: userId,
        item_id: resolvedId,
        image_url: renamedImageUrl,
      },
    ],
    imageStatus: 404,
  });
  // Reviews of other items may share the picture, so none is offered in its place
  assert.equal(await reportBrokenImage(renamedImageUrl), null);
  const write = fixture.writes.find((w) => w.table === "logs");
  assert.equal(write?.method, "PATCH");
  assert.equal(write?.body.image_url, null);
});

test("a list entry whose chosen picture is gone goes back to its item's picture", async () => {
  fixture = setup({
    cached: [{ ...folkItem, image_hidden: false }],
    listEntries: [
      { item_id: resolvedId, owner: userId, image_url: renamedImageUrl },
    ],
    imageStatus: 404,
  });
  assert.equal(await reportBrokenImage(renamedImageUrl), null);
  const write = fixture.writes.find((w) => w.table === "list_items");
  assert.equal(write?.method, "PATCH");
  assert.equal(write?.body.image_url, null);
});

test("a top 5 slot whose chosen picture is gone goes back to its item's picture", async () => {
  fixture = setup({
    cached: [{ ...folkItem, image_hidden: false }],
    favourites: [
      {
        user_id: userId,
        position: 1,
        item_id: resolvedId,
        image_url: renamedImageUrl,
      },
    ],
    imageStatus: 404,
  });
  assert.equal(await reportBrokenImage(renamedImageUrl), null);
  const write = fixture.writes.find((w) => w.table === "favourites");
  assert.equal(write?.method, "PATCH");
  assert.equal(write?.body.image_url, null);
});

test("an image that still loads for the server isn't replaced", async () => {
  fixture = setup({ cached: [renamedImageItem] });
  assert.equal(await reportBrokenImage(renamedImageUrl), null);
  assert.equal(fixture.lookups(), 0);
  assert.deepEqual(fixture.writes, []);
});

test("only stored Wikimedia images are checked", async () => {
  fixture = setup({ cached: [renamedImageItem], imageStatus: 404 });
  assert.equal(await reportBrokenImage("https://example.com/a.jpg"), null);
  assert.equal(
    await reportBrokenImage(
      "https://upload.wikimedia.org/wikipedia/commons/0/00/Unknown.jpg",
    ),
    null,
  );
  assert.deepEqual(fixture.imageChecks, []);
  assert.deepEqual(fixture.writes, []);
});

test("a failed item upsert prevents the dependent write and returns the error", async () => {
  fixture = setup({ upsertFails: true });
  assert.deepEqual(
    await logItem({ itemId: requestedId, rating: null, review: "" }),
    { error: "Item storage denied" },
  );
  assert.deepEqual(
    fixture.writes.map((w) => w.table),
    ["items"],
  );
});

test("dependent write failures still reach the caller", async () => {
  fixture = setup({ writeFails: true });
  assert.deepEqual(
    await logItem({ itemId: requestedId, rating: null, review: "" }),
    { error: "Write denied" },
  );
});

for (const source of ["uncached", "stale"] as const) {
  for (const target of ["page", "metadata"] as const) {
    test(`${target} temporarily redirects a ${source} alias to the resolved item`, async () => {
      fixture = setup({
        cached:
          source === "stale"
            ? [
                {
                  id: requestedId,
                  title,
                  image_url: imageUrl,
                  fetched_at: new Date(0).toISOString(),
                },
              ]
            : [],
      });
      const props = {
        params: Promise.resolve({ id: requestedId }),
        searchParams: Promise.resolve({}),
      };
      await assert.rejects(
        () => (target === "page" ? ItemPage(props) : generateMetadata(props)),
        { digest: `NEXT_REDIRECT;replace;/item/${resolvedId};307;` },
      );
      // Redirect before querying ratings or preparing forms for the alias.
      assert.deepEqual(fixture.writes, []);
    });
  }
}

test("refreshing an alias leaves it stale so later visits still resolve its canonical ID", async () => {
  fixture = setup({
    cached: [
      {
        id: requestedId,
        title: "Old alias",
        image_url: null,
        fetched_at: new Date(0).toISOString(),
      },
    ],
  });
  for (let visit = 0; visit < 2; visit++) {
    const result = await getItemForPage(requestedId);
    assert.ok("item" in result);
    assert.equal(result.item.id, resolvedId);
  }
  assert.equal(fixture.lookups(), 2);
  assert.deepEqual(fixture.writes, []);
});

test("refreshing a stale canonical item still updates its own cached row", async () => {
  fixture = setup({
    cached: [
      {
        id: resolvedId,
        title: "Old title",
        image_url: null,
        fetched_at: new Date(0).toISOString(),
      },
    ],
  });
  const result = await getItemForPage(resolvedId);
  assert.ok("item" in result);
  assert.equal(result.item.id, resolvedId);
  assert.equal(fixture.writes.length, 1);
  assert.equal(fixture.writes[0].method, "PATCH");
  assert.equal(fixture.writes[0].id, resolvedId);
  assert.equal(fixture.writes[0].body.title, title);
  await getItemForPage(resolvedId);
  assert.equal(fixture.lookups(), 1);
});

test("canonical item metadata renders without redirecting", async () => {
  fixture = setup();
  const metadata = await generateMetadata({
    params: Promise.resolve({ id: resolvedId }),
  });
  assert.equal(metadata.title, title);
});
