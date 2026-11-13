// ABOUTME: What we know about Wikipedia search results: the saved items' pictures and adult
// ABOUTME: flags, and which of the given image files are on English Wikipedia's bad image list.
import { type NextRequest, NextResponse } from "next/server";
import { fileTitle, shownImage } from "@/lib/format";
import { ITEM_ID_PATTERN } from "@/lib/ids";
import { createPublicClient } from "@/lib/supabase/public";
import { badImages } from "@/lib/wikipedia";

// More than a page of search results ever asks about
const MAX_ASKED = 20;

// How long to wait for the bad image list when it isn't kept yet
const LIST_WAIT_MS = 3000;

export type SavedResult = {
  id: string;
  imageUrl: string | null;
  nsfw: boolean;
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const ids = params
    .getAll("id")
    .filter((id) => ITEM_ID_PATTERN.test(id))
    .slice(0, MAX_ASKED);
  const files = params.getAll("file").slice(0, MAX_ASKED).map(fileTitle);

  const [rows, bad] = await Promise.all([
    ids.length
      ? createPublicClient()
          .from("items")
          .select("id, image_url, image_hidden, nsfw")
          .in("id", ids)
      : { data: [], error: null },
    files.length ? badImages(Date.now() + LIST_WAIT_MS) : new Set<string>(),
  ]);
  // Each lookup's answer, or null if it failed, so a failure only leaves the
  // results that lookup covers unknown
  const saved: SavedResult[] | null = rows.error
    ? null
    : (rows.data ?? []).map(
        (r: {
          id: string;
          image_url: string | null;
          image_hidden: boolean;
          nsfw: boolean;
        }) => ({ id: r.id, imageUrl: shownImage(r), nsfw: r.nsfw }),
      );
  const badFiles = bad ? files.filter((f) => bad.has(f)) : null;

  return NextResponse.json(
    { saved, badFiles },
    {
      headers: {
        // Short, so changed pictures and items newly marked as adult content
        // show soon. A failed lookup isn't kept, so the next search asks again.
        "Cache-Control":
          saved && badFiles
            ? "public, s-maxage=600, stale-while-revalidate=3600"
            : "no-store",
      },
    },
  );
}
