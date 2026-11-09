// ABOUTME: Serves an item's picture as a still JPEG for link previews, fetched from Wikimedia on our server.
// ABOUTME: Keeps previews working when the picture is a huge animated GIF or the previewer is blocked by Wikimedia.
import { connection } from "next/server";
import { FEATURES } from "@/lib/features";
import { absolute } from "@/lib/format";
import { isCompoundId } from "@/lib/ids";
import { getItemForPage } from "@/lib/items";
import { COLORS, stillImage } from "@/lib/shareImage";
import { HEADERS as WIKIMEDIA_HEADERS } from "@/lib/wikipedia";

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

  try {
    // An animated GIF becomes its first frame, and see-through parts white
    const picture = await stillImage(absolute(imageUrl), WIKIMEDIA_HEADERS);
    const jpeg = await picture
      .flatten({ background: COLORS.background })
      .jpeg({ quality: 85 })
      .toBuffer();

    return new Response(new Uint8Array(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        // Pictures rarely change, and a hidden one drops out within a day
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error(`Loading the picture for ${id} failed:`, error);
    return new Response("Picture unavailable", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
