// ABOUTME: Exercises item-saving actions against mocked Supabase and Wikimedia HTTP.
// ABOUTME: Checks that references use the stored ID when Wikipedia resolves another ID.
import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import headers from "next/headers";
import server from "next/server";
import {
  addToList,
  createCompound,
  logItem,
  setFavourite,
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

type Row = {
  id: string;
  fetched_at?: string;
  title: string;
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
  lookupFails = false,
  upsertFails = false,
  writeFails = false,
} = {}) {
  const previousEnv = { ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
  process.env.SUPABASE_SECRET_KEY = "test-secret-key";
  const compounds = FEATURES.compounds;
  FEATURES.compounds = true;
  mock.method(server, "connection", async () => {});
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
          } else if (["logs", "favourites", "list_items"].includes(table)) {
            // Model the FK that failed in production, rather than accepting any ID.
            if (!items.has(String(body.item_id)))
              return Response.json(
                { code: "23503", message: "Item does not exist" },
                { status: 409 },
              );
            if (writeFails)
              return Response.json(
                { code: "42501", message: "Write denied" },
                { status: 403 },
              );
          } else if (table === "rpc/create_compound") {
            assert.ok((body.p_parts as string[]).every((id) => items.has(id)));
            return Response.json({ id: "C1", title: "Music", existing: false });
          } else {
            assert.equal(table, "rpc/reorder_list_items");
          }
          return new Response(null, { status: 201 });
        }
        if (table === "items") {
          const item = items.get(
            url.searchParams.get("id")?.replace(/^eq\./, "") ?? "",
          );
          return Response.json(item ? [item] : []);
        }
        if (table === "lists") return Response.json([{ id: listId }]);
        assert.equal(table, "list_items");
        return Response.json([]);
      }
      if (url.searchParams.get("action") === "wbgetentities") {
        lookups++;
        if (lookupFails) return new Response(null, { status: 404 });
        const id = url.searchParams.get("ids") as string;
        return Response.json({
          entities: { [id]: { sitelinks: { enwiki: { title } } } },
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

test("adding to a ranked list uses the resolved ID in the row, order and response", async () => {
  fixture = setup();
  const order = ["Q89", requestedId, "Q90"];
  assert.deepEqual(await addToList({ listId, itemId: requestedId, order }), {
    item: { itemId: resolvedId, title, imageUrl },
  });
  assert.equal(
    fixture.writes.find((w) => w.table === "list_items")?.body.item_id,
    resolvedId,
  );
  assert.deepEqual(
    fixture.writes.find((w) => w.table === "rpc/reorder_list_items")?.body
      .p_items,
    ["Q89", resolvedId, "Q90"],
  );
  assert.deepEqual(order, ["Q89", requestedId, "Q90"]);
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
