// ABOUTME: One-off job that fills in the Wikidata types of items saved before types were stored.
// ABOUTME: Safe to stop and run again; it only touches items whose types are still empty.
//
// Run it from the project folder with:
//   npx tsx --env-file=.env.local scripts/backfill-item-types.ts
import { createClient } from "@supabase/supabase-js";

const BATCH = 100; // items per Wikidata query
const LABEL_BATCH = 50; // type names per Wikidata request
const PAUSE_MS = 1500; // a polite wait between requests

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set (use --env-file=.env.local).",
  );
}
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const contact = process.env.WIKI_CONTACT ?? "no contact set";
const HEADERS = {
  "User-Agent": `Compend/0.1 (https://compend.org; ${contact})`,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Fetches with a few retries, waiting longer each time or as long as
// Wikimedia asks. Returns null when it keeps failing.
async function fetchJson(
  makeRequest: () => Promise<Response>,
): Promise<unknown | null> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await makeRequest();
      if (res.ok) return await res.json();
      const asked = Number(res.headers.get("retry-after"));
      const wait = asked > 0 ? asked * 1000 : attempt * 5000;
      console.warn(`  Wikimedia answered ${res.status}, waiting ${wait}ms`);
      await sleep(wait);
    } catch (e) {
      console.warn("  Request failed:", e instanceof Error ? e.message : e);
      await sleep(attempt * 5000);
    }
  }
  return null;
}

type SparqlResult = {
  results?: {
    bindings?: { item?: { value: string }; type?: { value: string } }[];
  };
};

const idOf = (uri: string) => uri.slice(uri.lastIndexOf("/") + 1);

// What each of these items is an instance of: a map from item ID to type IDs.
// An item with no type gets an empty list. Null if the query failed.
async function typesOf(ids: string[]): Promise<Map<string, string[]> | null> {
  const query = `SELECT ?item ?type WHERE {
    VALUES ?item { ${ids.map((id) => `wd:${id}`).join(" ")} }
    OPTIONAL { ?item wdt:P31 ?type }
  }`;
  const data = (await fetchJson(() =>
    fetch("https://query.wikidata.org/sparql", {
      method: "POST",
      headers: {
        ...HEADERS,
        Accept: "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ query }),
    }),
  )) as SparqlResult | null;
  if (!data) return null;

  const found = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const b of data.results?.bindings ?? []) {
    if (!b.item) continue;
    const list = found.get(idOf(b.item.value));
    if (list && b.type) list.push(idOf(b.type.value));
  }
  return found;
}

async function fillTypes() {
  const { count } = await supabase
    .from("items")
    .select("*", { count: "exact", head: true })
    .is("types", null)
    .like("id", "Q%");
  console.log(`${count ?? 0} items need their types.`);

  let done = 0;
  let skipped = 0;
  let lastId = "";
  for (;;) {
    // After the last ID seen, so an item that fails can't make this loop forever
    const { data, error } = await supabase
      .from("items")
      .select("id")
      .is("types", null)
      .like("id", "Q%")
      .gt("id", lastId)
      .order("id")
      .limit(BATCH);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    const ids = data.map((r) => r.id as string);
    lastId = ids[ids.length - 1];

    const found = await typesOf(ids);
    if (!found) {
      skipped += ids.length;
      console.warn(
        `  Skipped ${ids.length} items; run the script again later.`,
      );
    } else {
      const rows = [...found].map(([id, types]) => ({ id, types }));
      const { error: writeError } = await supabase.rpc("set_item_types", {
        p_rows: rows,
      });
      if (writeError) throw new Error(writeError.message);
      done += ids.length;
    }
    console.log(`  ${done} done${skipped ? `, ${skipped} skipped` : ""}`);
    await sleep(PAUSE_MS);
  }
  console.log(`Types filled in for ${done} items.`);
}

type LabelResult = {
  entities?: Record<string, { labels?: { en?: { value: string } } }>;
};

// Gives every type that items use a name, if it doesn't have one yet
async function fillLabels() {
  const { data, error } = await supabase.rpc("missing_type_ids");
  if (error) throw new Error(error.message);
  const missing = (data ?? []) as string[];
  console.log(`${missing.length} types need a name.`);

  for (let i = 0; i < missing.length; i += LABEL_BATCH) {
    const ids = missing.slice(i, i + LABEL_BATCH);
    const params = new URLSearchParams({
      action: "wbgetentities",
      ids: ids.join("|"),
      props: "labels",
      languages: "en",
      format: "json",
    });
    const result = (await fetchJson(() =>
      fetch(`https://www.wikidata.org/w/api.php?${params}`, {
        headers: HEADERS,
      }),
    )) as LabelResult | null;
    if (!result) continue;

    const rows = ids.map((id) => ({
      id,
      label: result.entities?.[id]?.labels?.en?.value ?? id,
    }));
    const { error: writeError } = await supabase
      .from("item_types")
      .upsert(rows);
    if (writeError) throw new Error(writeError.message);
    console.log(`  ${Math.min(i + LABEL_BATCH, missing.length)} named`);
    await sleep(PAUSE_MS);
  }
}

async function main() {
  await fillTypes();
  await fillLabels();
  console.log("Finished.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});