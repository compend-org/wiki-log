// ABOUTME: Looks saved items up on Wikipedia again and reports the ones whose stored image is a different file from the one found now.
// ABOUTME: Scans the items an image lookup failure could have affected, or checks the given IDs; --write saves them.
//
// Run it from the project folder with:
//   npx tsx --env-file=.env.local scripts/recheck-item-images.ts scan [after-id] [--write]
//   npx tsx --env-file=.env.local scripts/recheck-item-images.ts ids Q2081372 [more IDs] [--write]
//
// A scan is safe to stop and run again; pass the last ID it printed to carry
// on from there. Without --write, nothing is saved. Each item takes several
// Wikimedia requests and items are checked one at a time, a second apart.
import { createClient } from "@supabase/supabase-js";
import { fileNameFromUrl } from "@/lib/format";
import { applyImageHidden, itemColumns } from "@/lib/items";
import { getItemById } from "@/lib/wikipedia/wikipedia";

const BATCH = 100; // items read from the database at a time
const PAUSE_MS = 1000; // a polite wait between items
// Long enough to wait out the pauses Wikimedia asks for, so a throttled
// lookup is retried rather than reported as failed
const ITEM_DEADLINE_MS = 120_000;

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
  title: string;
  image_url: string | null;
  image_hidden: boolean;
};

const COLUMNS = "id, title, image_url, image_hidden";

// The items a failed image lookup could have left with the wrong image: those
// with no image, and those whose image is the first article image, which is
// the only image whose address comes from a Wikipedia imageinfo request.
// Representative images come from the summary or PageImages, so they're
// unaffected.
const SUSPECTS =
  'image_url.is.null,image_url.like."*.wikipedia.org&utm_campaign=imageinfo*"';

type Outcome = "same" | "different" | "failed";

// The same file can come back at another width or with other query
// parameters, so images are compared by file
function imageFile(url: string | null): string | null {
  return url && (fileNameFromUrl(url) ?? url);
}

// Looks one item up again, reports it if its image differs, and with `write`
// saves the item as looked up
async function recheck(row: Row, write: boolean): Promise<Outcome> {
  const result = await getItemById(row.id, Date.now() + ITEM_DEADLINE_MS);
  if ("error" in result) {
    console.log(`  ${row.id} ${row.title}: lookup failed (${result.error})`);
    return "failed";
  }
  if (result.item.imageLookupFailed) {
    console.log(`  ${row.id} ${row.title}: image lookup failed`);
    return "failed";
  }
  // Wikidata can redirect an ID to another item; that row isn't this one's
  if (result.item.id !== row.id) {
    console.log(`  ${row.id} ${row.title}: now ${result.item.id}, skipped`);
    return "failed";
  }
  if (imageFile(result.item.imageUrl) === imageFile(row.image_url)) {
    return "same";
  }

  console.log(`  ${row.id} ${row.title}`);
  console.log(`    stored: ${row.image_url ?? "(none)"}`);
  console.log(`    found:  ${result.item.imageUrl ?? "(none)"}`);

  if (write) {
    // A hidden image stays hidden
    const item = applyImageHidden(result.item, row.image_hidden);
    const { error } = await supabase
      .from("items")
      .update(itemColumns(item))
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    console.log("    saved");
  }
  return "different";
}

function summary(counts: Record<Outcome, number>, write: boolean): string {
  const total = counts.same + counts.different + counts.failed;
  return `${total} checked, ${counts.different} different${write ? " (saved)" : ""}, ${counts.failed} failed`;
}

async function scan(afterId: string, write: boolean) {
  let lastId = afterId;
  const counts: Record<Outcome, number> = { same: 0, different: 0, failed: 0 };
  for (;;) {
    // Compounds live only in our database, so only Wikidata items are checked
    const { data, error } = await supabase
      .from("items")
      .select(COLUMNS)
      .like("id", "Q%")
      .or(SUSPECTS)
      .gt("id", lastId)
      .order("id")
      .limit(BATCH);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    for (const row of data as Row[]) {
      counts[await recheck(row, write)]++;
      await sleep(PAUSE_MS);
    }
    lastId = data[data.length - 1].id;
    console.log(`  ${summary(counts, write)}, up to ${lastId}`);
  }
  console.log(`Finished: ${summary(counts, write)}.`);
}

async function checkIds(ids: string[], write: boolean) {
  const { data, error } = await supabase
    .from("items")
    .select(COLUMNS)
    .in("id", ids);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];

  for (const id of ids.filter((id) => !rows.some((r) => r.id === id))) {
    console.log(`  ${id}: not a saved item`);
  }
  const counts: Record<Outcome, number> = { same: 0, different: 0, failed: 0 };
  for (const row of rows) {
    counts[await recheck(row, write)]++;
    await sleep(PAUSE_MS);
  }
  console.log(`Finished: ${summary(counts, write)}.`);
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const [mode, ...rest] = args.filter((a) => a !== "--write");

  if (mode === "scan") return scan(rest[0] ?? "", write);
  if (mode === "ids" && rest.length > 0) return checkIds(rest, write);
  throw new Error(
    "Usage: recheck-item-images.ts scan [after-id] [--write] | ids <ID>... [--write]",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
