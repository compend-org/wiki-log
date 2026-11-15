// ABOUTME: Serves an item's picture for link previews: a still JPEG fetched on our server, or a compound's enlarged drawing.
// ABOUTME: Keeps previews working when the picture is a huge animated GIF or the previewer is blocked by Wikimedia.
import { connection } from "next/server";
import { FEATURES } from "@/lib/features";
import { absolute } from "@/lib/format";
import { isCompoundId } from "@/lib/ids";
import { getItemForPage } from "@/lib/items";
import { previewImageResponse } from "@/lib/shareImage";
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

  return previewImageResponse(
    absolute(imageUrl),
    WIKIMEDIA_HEADERS,
    id,
    isCompoundId(id),
  );
}
