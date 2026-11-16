// ABOUTME: Serves the picture a review shows as a still JPEG for link previews, fetched from Wikimedia on our server.
// ABOUTME: Used when the review's author chose a picture of their own; other reviews use their item's picture route.
import { connection } from "next/server";
import { absolute, entryPicture } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { getProfileByName } from "@/lib/profiles";
import { getReview } from "@/lib/reviews";
import { stillJpegResponse } from "@/lib/shareImage";
import { HEADERS as WIKIMEDIA_HEADERS } from "@/lib/wikipedia/wikipedia";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/u/[username]/[logId]/picture">,
) {
  await connection();
  const { username, logId } = await params;
  if (!isUuid(logId)) return new Response("Not found", { status: 404 });

  const profile = await getProfileByName(username);
  if (!profile) return new Response("Not found", { status: 404 });
  const log = await getReview(logId, profile.id);
  const imageUrl = log ? entryPicture(log) : null;
  if (!imageUrl) return new Response("Not found", { status: 404 });

  return stillJpegResponse(absolute(imageUrl), WIKIMEDIA_HEADERS, logId);
}
