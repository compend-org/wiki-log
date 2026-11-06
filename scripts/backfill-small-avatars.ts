// ABOUTME: One-off job that stores the small copy of profile pictures uploaded before small copies existed.
// ABOUTME: Safe to stop and run again; it skips pictures whose small copy is already stored.
//
// Run it from the project folder with:
//   npx tsx --env-file=.env.local scripts/backfill-small-avatars.ts
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { AVATAR_SMALL_SIZE, smallAvatarPath } from "../lib/avatar";

const PAGE = 500; // profiles per database request
const CONCURRENCY = 10; // pictures handled at the same time

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
const bucket = supabase.storage.from("avatars");

// Every stored picture path, read a page at a time
async function avatarPaths(): Promise<string[]> {
  const paths: string[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("profiles")
      .select("avatar_path")
      .not("avatar_path", "is", null)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Reading profiles failed: ${error.message}`);
    for (const row of data) paths.push(row.avatar_path as string);
    if (data.length < PAGE) return paths;
  }
}

// Whether a file is already stored, by listing the folder it would be in
async function isStored(path: string): Promise<boolean> {
  const slash = path.lastIndexOf("/");
  const { data, error } = await bucket.list(path.slice(0, slash), {
    search: path.slice(slash + 1),
  });
  if (error) throw new Error(`Listing ${path} failed: ${error.message}`);
  return data.some((f) => f.name === path.slice(slash + 1));
}

// Shrinks the stored full picture and uploads the result as its small copy
async function storeSmallCopy(path: string): Promise<void> {
  const { data, error } = await bucket.download(path);
  if (error) throw new Error(`Downloading failed: ${error.message}`);

  const small = await sharp(Buffer.from(await data.arrayBuffer()))
    .resize(AVATAR_SMALL_SIZE, AVATAR_SMALL_SIZE, { fit: "cover" })
    .jpeg({ quality: 85 })
    .toBuffer();

  const { error: uploadError } = await bucket.upload(
    smallAvatarPath(path),
    small,
    { contentType: "image/jpeg", cacheControl: "31536000" },
  );
  if (uploadError) throw new Error(`Uploading failed: ${uploadError.message}`);
}

async function main() {
  const paths = await avatarPaths();
  console.log(`${paths.length} profiles have a picture`);

  let stored = 0;
  let skipped = 0;
  let failed = 0;
  for (let i = 0; i < paths.length; i += CONCURRENCY) {
    await Promise.all(
      paths.slice(i, i + CONCURRENCY).map(async (path) => {
        try {
          if (await isStored(smallAvatarPath(path))) {
            skipped++;
            return;
          }
          await storeSmallCopy(path);
          stored++;
        } catch (e) {
          failed++;
          console.warn(`  ${path}: ${e instanceof Error ? e.message : e}`);
        }
      }),
    );
    if ((i / CONCURRENCY) % 10 === 9) {
      console.log(`  ${stored} stored, ${skipped} skipped, ${failed} failed`);
    }
  }

  console.log(
    `Finished: ${stored} stored, ${skipped} skipped, ${failed} failed`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
