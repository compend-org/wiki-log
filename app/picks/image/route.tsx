// ABOUTME: Draws the day's most and least popular items as a 1080×1350 PNG, sized for an Instagram post.
// ABOUTME: Looks like the two squares on the home page, side by side, with the date and the site's logo.
import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { getDailyPicks, type Pick } from "@/lib/dailyPicks";
import { FEATURES } from "@/lib/features";
import { absolute, shortLabel, thumbUrl } from "@/lib/format";
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

// The squares are the home page's squares scaled up: one site pixel is this
// many image pixels, which makes the two squares fill the image's width
const SCALE = 2.6;
const px = (sitePixels: number) => Math.round(sitePixels * SCALE);

// Every picture on the site has a thin frame
const FRAME = `${px(1)}px solid ${COLORS.line}`;

function Square({
  heading,
  pick,
  image,
}: {
  heading: string;
  pick: Pick | null;
  image: string | null;
}) {
  const label = (
    <div
      style={{
        fontSize: px(10.4),
        fontWeight: 700,
        letterSpacing: px(0.4),
        textTransform: "uppercase",
        color: COLORS.muted,
      }}
    >
      {heading}
    </div>
  );

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: pick ? "flex-start" : "center",
        gap: px(8),
        padding: px(8),
        border: `${px(2)}px dashed ${COLORS.line}`,
        textAlign: "center",
      }}
    >
      {label}
      {!pick ? (
        <div style={{ fontSize: px(12), color: COLORS.muted }}>
          Nothing rated in the last 24 hours
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: px(8),
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: px(130),
            }}
          >
            {image ? (
              // Natural proportions, as large as fits the box
              // biome-ignore lint/performance/noImgElement: drawn into a PNG, not shown on a page
              <img
                src={image}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: px(112),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: px(6),
                  fontSize: px(16),
                  fontWeight: 700,
                  color: COLORS.muted,
                  background: COLORS.surface,
                  border: FRAME,
                }}
              >
                {shortLabel(pick.title)}
              </div>
            )}
          </div>
          <div
            style={{
              // Only as wide as the title, so the square centres it. A long
              // title wraps; lineClamp would stretch it to full width.
              display: "block",
              maxWidth: "100%",
              textAlign: "center",
              fontSize: px(14),
              fontWeight: 700,
              lineHeight: 1.3,
            }}
          >
            {pick.title}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: px(4),
              fontSize: px(12),
              color: COLORS.muted,
            }}
          >
            <Star size={px(12)} />
            {`${pick.average.toFixed(1)} · ${pick.count} ${pick.count === 1 ? "rating" : "ratings"}`}
          </div>
        </div>
      )}
    </div>
  );
}

export async function GET(request: Request) {
  await connection();
  if (!FEATURES.dailyPicks) return new Response("Not found", { status: 404 });

  const picks = await getDailyPicks();
  const siteFile = (path: string) => new URL(path, request.url).toString();
  const pickImage = (pick: Pick | null) =>
    pick?.imageUrl
      ? embeddable(thumbUrl(absolute(pick.imageUrl), 600), WIKIMEDIA_HEADERS)
      : null;

  const [fonts, popularImage, unpopularImage, logo] = await Promise.all([
    loadSerifFonts(),
    pickImage(picks.popular),
    pickImage(picks.unpopular),
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
        gap: px(22),
        padding: 64,
        background: COLORS.background,
        color: COLORS.foreground,
        fontFamily: "Tinos",
      }}
    >
      <div style={{ display: "flex", gap: px(15) }}>
        <Square
          heading="Popular Today"
          pick={picks.popular}
          image={popularImage}
        />
        <Square
          heading="Unpopular Today"
          pick={picks.unpopular}
          image={unpopularImage}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: px(13),
          color: COLORS.muted,
        }}
      >
        {new Date().toISOString().slice(0, 10)}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: px(6),
            marginLeft: "auto",
            fontSize: px(15),
            fontWeight: 700,
            color: COLORS.foreground,
          }}
        >
          {logo && (
            // biome-ignore lint/performance/noImgElement: drawn into a PNG, not shown on a page
            <img src={logo} alt="" width={px(26)} height={px(26)} />
          )}
          {SITE_NAME}
        </div>
      </div>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts,
      // The picks change through the day, so a drawn image is reused by
      // everyone for a minute and then drawn again
      headers: { "Cache-Control": "public, s-maxage=60" },
    },
  );
  return smallerPng(image);
}
