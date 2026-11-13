// ABOUTME: Says which of the given items and image files are adult content, for search results.
// ABOUTME: Items by their saved flag, files by English Wikipedia's bad image list.
import { type NextRequest, NextResponse } from "next/server";
import { fileTitle } from "@/lib/format";
import { ITEM_ID_PATTERN } from "@/lib/ids";
import { createPublicClient } from "@/lib/supabase/public";
import { badImages } from "@/lib/wikipedia";

// More than a page of search results ever asks about
const MAX_ASKED = 20;

// How long to wait for the bad image list when it isn't kept yet
const LIST_WAIT_MS = 3000;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const ids = params
    .getAll("id")
    .filter((id) => ITEM_ID_PATTERN.test(id))
    .slice(0, MAX_ASKED);
  const files = params.getAll("file").slice(0, MAX_ASKED).map(fileTitle);

  const [saved, bad] = await Promise.all([
    ids.length
      ? createPublicClient()
          .from("items")
          .select("id")
          .in("id", ids)
          .eq("nsfw", true)
      : { data: [], error: null },
    files.length ? badImages(Date.now() + LIST_WAIT_MS) : new Set<string>(),
  ]);
  if (saved.error || !bad) {
    return NextResponse.json({ error: "Lookup failed" }, { status: 503 });
  }

  return NextResponse.json(
    {
      ids: (saved.data ?? []).map((r: { id: string }) => r.id),
      files: files.filter((f) => bad.has(f)),
    },
    {
      headers: {
        // Short, so items newly marked as adult content blur soon
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
      },
    },
  );
}
