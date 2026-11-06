// ABOUTME: Draws one review as a 1080×1350 PNG, sized for an Instagram post.
// ABOUTME: Looks like the review card on the site, with the like and share counts and the site's logo.
import { ImageResponse } from "next/og";
import { connection } from "next/server";
import HeartIcon from "@/components/HeartIcon";
import ShareIcon from "@/components/ShareIcon";
import { avatarUrl } from "@/lib/avatar";
import { absolute, plainReview, shortLabel, thumbUrl } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { getProfileByName } from "@/lib/profiles";
import { getReview } from "@/lib/reviews";
import { SITE_NAME } from "@/lib/site";
import { HEADERS as WIKIMEDIA_HEADERS } from "@/lib/wikipedia";

const WIDTH = 1080;
const HEIGHT = 1350;

// The site's light theme colours, from globals.css
const COLORS = {
  background: "#ffffff",
  surface: "#f1f3f8",
  line: "#a9adb8",
  foreground: "#000000",
  muted: "#555555",
  star: "#c98a00",
};

// The card is the site's review card scaled up: one site pixel is this many
// image pixels, which makes the card fill the image's width
const SCALE = 2.6;
const px = (sitePixels: number) => Math.round(sitePixels * SCALE);

// The most lines of review shown before it's cut off with an ellipsis
const REVIEW_LINES = 10;

type Font = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
};

// Tinos is a free serif drawn to the same measurements as Times New Roman,
// the site's own font. It's fetched once per server and reused.
let serifFonts: Promise<Font[]> | null = null;

function loadSerifFonts(): Promise<Font[]> {
  serifFonts ??= (async () => {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Tinos:wght@400;700",
    ).then((res) => res.text());
    const faces = [
      ...css.matchAll(/font-weight: (400|700);\s*src: url\((.+?)\)/g),
    ];
    if (faces.length === 0) throw new Error("No Tinos fonts found");
    return Promise.all(
      faces.map(async ([, weight, url]) => ({
        name: "Tinos",
        data: await fetch(url).then((res) => res.arrayBuffer()),
        weight: Number(weight) as 400 | 700,
        style: "normal" as const,
      })),
    );
  })().catch((error) => {
    // Try again on the next image; this one uses the default font
    console.error("Loading the review image font failed:", error);
    serifFonts = null;
    return [];
  });
  return serifFonts;
}

// An image as a data address the renderer can draw, or null when it can't be
// fetched or is in a format the renderer doesn't support
async function embeddable(
  url: string,
  headers?: Record<string, string>,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(png|jpeg|gif)$/.test(type)) return null;
    const data = Buffer.from(await res.arrayBuffer()).toString("base64");
    return `data:${type};base64,${data}`;
  } catch {
    return null;
  }
}

// Five-pointed stars for a rating out of 5, with a half star for .5
function Stars({ rating, size }: { rating: number; size: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const star =
    "12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26";
  const leftHalf = "12,2 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26";

  return (
    <div style={{ display: "flex" }}>
      {Array.from({ length: full }, (_, i) => (
        <svg
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed-order list whose entries repeat
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <polygon points={star} fill={COLORS.star} />
        </svg>
      ))}
      {half && (
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <polygon points={leftHalf} fill={COLORS.star} />
        </svg>
      )}
    </div>
  );
}

export async function GET(
  request: Request,
  { params }: RouteContext<"/u/[username]/[logId]/image">,
) {
  await connection();
  const { username, logId } = await params;
  if (!isUuid(logId)) return new Response("Not found", { status: 404 });

  const profile = await getProfileByName(username);
  if (!profile) return new Response("Not found", { status: 404 });
  const log = await getReview(logId, profile.id);
  if (!log) return new Response("Not found", { status: 404 });

  const title = log.items?.title ?? "Unknown item";
  const itemImageUrl = log.items?.image_hidden ? null : log.items?.image_url;
  const rating = Math.max(0, Math.min(5, Number(log.rating ?? 0)));
  const text = plainReview(log.review).trim();
  const likes = log.likes?.[0]?.count ?? 0;
  const shares = log.shares?.[0]?.count ?? 0;
  const siteFile = (path: string) => new URL(path, request.url).toString();

  const [fonts, itemImage, avatar, logo] = await Promise.all([
    loadSerifFonts(),
    itemImageUrl
      ? embeddable(thumbUrl(absolute(itemImageUrl), 600), WIKIMEDIA_HEADERS)
      : null,
    embeddable(
      avatarUrl(profile.avatar_path) ?? siteFile("/default-avi-light.png"),
    ),
    embeddable(siteFile("/logo-light.png")),
  ]);

  // Every picture on the site has a thin frame
  const frame = `${px(1)}px solid ${COLORS.line}`;
  const imageSize = px(105);

  return new ImageResponse(
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: px(11),
          padding: px(15),
          border: `${px(2)}px dashed ${COLORS.line}`,
        }}
      >
        <div style={{ display: "flex", gap: px(15) }}>
          {itemImage ? (
            // biome-ignore lint/performance/noImgElement: drawn into a PNG, not shown on a page
            <img
              src={itemImage}
              alt=""
              width={imageSize}
              height={imageSize}
              style={{ objectFit: "cover", border: frame, flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: imageSize,
                height: imageSize,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: px(6),
                textAlign: "center",
                fontSize: px(14),
                fontWeight: 700,
                color: COLORS.muted,
                background: COLORS.surface,
                border: frame,
              }}
            >
              {shortLabel(title)}
            </div>
          )}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: px(4),
            }}
          >
            <div
              style={{
                display: "block",
                fontSize: px(19),
                fontWeight: 700,
                lineHeight: 1.4,
                lineClamp: 2,
              }}
            >
              {title}
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: px(6),
                fontSize: px(13),
                color: COLORS.muted,
              }}
            >
              <span>Review by</span>
              {avatar && (
                // biome-ignore lint/performance/noImgElement: drawn into a PNG, not shown on a page
                <img
                  src={avatar}
                  alt=""
                  width={px(20)}
                  height={px(20)}
                  style={{
                    objectFit: "cover",
                    borderRadius: px(10),
                    border: frame,
                  }}
                />
              )}
              <span style={{ textDecoration: "underline" }}>
                {profile.username}
              </span>
              <span>· {log.logged_at.slice(0, 10)}</span>
            </div>
            {rating > 0 && <Stars rating={rating} size={px(16.5)} />}
          </div>
        </div>

        {text && (
          <div
            style={{
              display: "block",
              fontSize: px(15),
              lineHeight: 1.5,
              lineClamp: REVIEW_LINES,
              whiteSpace: "pre-wrap",
            }}
          >
            {text}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: px(15),
          fontSize: px(13),
          color: COLORS.muted,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: px(4) }}>
          <HeartIcon size={px(16)} />
          {likes}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: px(4) }}>
          <ShareIcon size={px(16)} />
          {shares}
        </div>
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
      // The like and share counts change, so the image is drawn fresh each time
      headers: { "Cache-Control": "no-store" },
    },
  );
}
