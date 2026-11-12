// ABOUTME: Draws one review as a 1080×1350 PNG, sized for an Instagram post.
// ABOUTME: Looks like the review card on the site, with the like and share counts and the site's logo.
import { ImageResponse } from "next/og";
import { connection } from "next/server";
import HeartIcon from "@/components/HeartIcon";
import ShareIcon from "@/components/icons/ShareIcon";
import { avatarUrl } from "@/lib/avatar";
import { absolute, plainReview, shortLabel, thumbUrl } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { getProfileByName } from "@/lib/profiles";
import { getReview } from "@/lib/reviews";
import {
  COLORS,
  embeddable,
  loadSerifFonts,
  SiteSignature,
  Stars,
  smallerPng,
} from "@/lib/shareImage";
import { HEADERS as WIKIMEDIA_HEADERS } from "@/lib/wikipedia";

const WIDTH = 1080;
const HEIGHT = 1350;

// The card is the site's review card scaled up: one site pixel is this many
// image pixels, which makes the card fill the image's width
const SCALE = 2.6;
const px = (sitePixels: number) => Math.round(sitePixels * SCALE);

// The most lines of review shown before it's cut off with an ellipsis
const REVIEW_LINES = 10;

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
        <SiteSignature logo={logo} />
      </div>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts,
      // The like and share counts change, so a drawn image is reused by
      // everyone for a minute and then drawn again. A removed review is only
      // visible to its author, so its image is never shared with others.
      headers: {
        "Cache-Control": log.removed_at ? "no-store" : "public, s-maxage=60",
      },
    },
  );
  return smallerPng(image);
}
