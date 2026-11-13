// ABOUTME: One-off job that checks every saved item for adult content and flags the ones that are.
// ABOUTME: Safe to stop and run again; pass the last ID it printed to carry on from there.
//
// Run it from the project folder with:
//   npx tsx --env-file=.env.local scripts/backfill-item-nsfw.ts [after-id]
import { createClient } from "@supabase/supabase-js";
import { isNsfw } from "@/lib/wikipedia";

const BATCH = 100; // items read from the database at a time
const PAUSE_MS = 250; // a polite wait between items

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Row = {
  id: string;
  types: string[] | null;
  image_url: string | null;
  nsfw: boolean;
};

async function main() {
  let lastId = process.argv[2] ?? "";
  let checked = 0;
  let changed = 0;
  for (;;) {
    // Compounds live only in our database, so only Wikidata items are checked
    const { data, error } = await supabase
      .from("items")
      .select("id, types, image_url, nsfw")
      .like("id", "Q%")
      .gt("id", lastId)
      .order("id")
      .limit(BATCH);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    for (const row of data as Row[]) {
      // A failed lookup reads as "not adult", so a flag is only ever set here,
      // never cleared
      if (!row.nsfw && (await isNsfw(row.id, row.types, row.image_url))) {
        const { error: writeError } = await supabase
          .from("items")
          .update({ nsfw: true })
          .eq("id", row.id);
        if (writeError) throw new Error(writeError.message);
        changed++;
        console.log(`  ${row.id}: adult content`);
      }
      checked++;
      await sleep(PAUSE_MS);
    }
    lastId = data[data.length - 1].id;
    console.log(`  ${checked} checked, ${changed} flagged, up to ${lastId}`);
  }
  console.log(`Finished: ${checked} checked, ${changed} flagged.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
