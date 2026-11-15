// ABOUTME: Serves an item's picture as a still JPEG for link previews, fetched from Wikimedia on our server.
// ABOUTME: Keeps previews working when the picture is a huge animated GIF or the previewer is blocked by Wikimedia.
import { connection } from "next/server";
import { FEATURES } from "@/lib/features";
import { absolute } from "@/lib/format";
import { isCompoundId } from "@/lib/ids";
import { getItemForPage } from "@/lib/items";
import { stillJpegResponse } from "@/lib/shareImage";
import { HEADERS as WIKIMEDIA_HEADERS } from "@/lib/wikipedia/wikipedia";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/item/[id]/image">,
) {
  await connection();
  const { id } = await params;
  if (isCompoundId(id) && !FEATURES.compounds) {
    return new Response("Not found", { status: 404 });
  }

  const result = await getItemForPage(id);
  const imageUrl = "item" in result ? result.item.imageUrl : null;
  if (!imageUrl) return new Response("Not found", { status: 404 });

  return stillJpegResponse(absolute(imageUrl), WIKIMEDIA_HEADERS, id);
}
