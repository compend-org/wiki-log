// ABOUTME: Draws an item with its ratings histogram as a 1080×1350 PNG, sized for an Instagram post.
// ABOUTME: Shows the item's picture, title and description above the histogram, with the site's logo.
import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { FEATURES } from "@/lib/features";
import { absolute, shortLabel, thumbUrl } from "@/lib/format";
import { isCompoundId } from "@/lib/ids";
import { getItemRatings } from "@/lib/itemRatings";
import { getItemForPage } from "@/lib/items";
import {
  barHeight,
  MIN_HISTOGRAM_RATINGS,
  RATING_STEPS,
  ratingHistogram,
} from "@/lib/ratingHistogram";
import {
  COLORS,
  embeddable,
  loadSerifFonts,
  Star,
  smallerPng,
} from "@/lib/shareImage";
import { SITE_NAME } from "@/lib/site";
import { HEADERS as WIKIMEDIA_HEADERS } from "@/lib/wikipedia";

const WIDTH = 1080;
const HEIGHT = 1350;

// The page is the site's item page scaled up: one site pixel is this many
// image pixels, which makes the histogram fill the image's width
const SCALE = 2.6;
const px = (sitePixels: number) => Math.round(sitePixels * SCALE);

// Every picture on the site has a thin frame
const FRAME = `${px(1)}px solid ${COLORS.line}`;

export async function GET(
  request: Request,
  { params }: RouteContext<"/item/[id]/ratings-image">,
) {
  await connection();
  const { id } = await params;
  if (isCompoundId(id) && !FEATURES.compounds) {
    return new Response("Not found", { status: 404 });
  }

  const [result, { ratings }] = await Promise.all([
    getItemForPage(id),
    getItemRatings(id),
  ]);
  // Like the page, the histogram is only drawn once there are enough ratings
  if ("error" in result || ratings.length < MIN_HISTOGRAM_RATINGS) {
    return new Response("Not found", { status: 404 });
  }
  const { item } = result;
  const { counts, tallest, average, people } = ratingHistogram(ratings);
  const siteFile = (path: string) => new URL(path, request.url).toString();

  const [fonts, itemImage, logo] = await Promise.all([
    loadSerifFonts(),
    item.imageUrl
      ? embeddable(thumbUrl(absolute(item.imageUrl), 600), WIKIMEDIA_HEADERS)
      : null,
    embeddable(siteFile("/logo-light.png")),
  ]);

  const image = new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: px(15),
        padding: 64,
        background: COLORS.background,
        color: COLORS.foreground,
        fontFamily: "Tinos",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: px(160),
        }}
      >
        {itemImage ? (
          // Natural proportions, as large as fits the box
          // biome-ignore lint/performance/noImgElement: drawn into a PNG, not shown on a page
          <img
            src={itemImage}
            alt=""
            style={{
              height: "100%",
              maxWidth: "100%",
              objectFit: "contain",
              border: `${px(2)}px dashed ${COLORS.line}`,
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: px(6),
              fontSize: px(19),
              fontWeight: 700,
              color: COLORS.muted,
              background: COLORS.surface,
              border: FRAME,
            }}
          >
            {shortLabel(item.title)}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: px(4) }}>
        <div
          style={{
            display: "block",
            fontSize: px(26),
            fontWeight: 700,
            lineHeight: 1.25,
            lineClamp: 2,
          }}
        >
          {item.title}
        </div>
        {item.description && (
          <div
            style={{
              display: "block",
              fontSize: px(14),
              lineHeight: 1.4,
              lineClamp: 2,
              color: COLORS.muted,
            }}
          >
            {item.description}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: px(8),
          padding: px(15),
          border: `${px(2)}px dashed ${COLORS.line}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: px(13),
            color: COLORS.muted,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              letterSpacing: px(0.4),
              textTransform: "uppercase",
            }}
          >
            Ratings
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: px(4) }}>
            <Star size={px(13)} />
            {`${average.toFixed(1)} average · ${people} ${people === 1 ? "person" : "people"}`}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: px(4),
            height: px(110),
          }}
        >
          {RATING_STEPS.map((step, i) => (
            <div
              key={step}
              style={{
                flex: 1,
                height: barHeight(counts[i], tallest),
                borderRadius: px(2),
                // The site's bars: muted at half strength, an empty one the
                // colour of a line
                background:
                  counts[i] > 0 ? `${COLORS.muted}80` : `${COLORS.line}99`,
              }}
            />
          ))}
        </div>

        <div
          style={{
            display: "flex",
            gap: px(4),
            fontSize: px(11),
            color: COLORS.muted,
          }}
        >
          {RATING_STEPS.map((step) => (
            <div
              key={step}
              style={{ flex: 1, display: "flex", justifyContent: "center" }}
            >
              {/* Whole stars only, so the labels don't crowd */}
              {Number.isInteger(step) ? String(step) : ""}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: px(6),
          fontSize: px(15),
          fontWeight: 700,
        }}
      >
        {logo && (
          // biome-ignore lint/performance/noImgElement: drawn into a PNG, not shown on a page
          <img src={logo} alt="" width={px(26)} height={px(26)} />
        )}
        {SITE_NAME}
      </div>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts,
      // New ratings change the histogram, so a drawn image is reused by
      // everyone for a minute and then drawn again
      headers: { "Cache-Control": "public, s-maxage=60" },
    },
  );
  return smallerPng(image);
}
