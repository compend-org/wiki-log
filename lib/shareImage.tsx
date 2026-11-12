// ABOUTME: Colours, fonts, stars and picture loading shared by the images people share from the site.
// ABOUTME: Each image route draws its own layout with these.
import sharp, { type Sharp } from "sharp";
import { SITE_NAME } from "@/lib/site";

// The site's light theme colours, from globals.css
export const COLORS = {
  background: "#ffffff",
  surface: "#f1f3f8",
  line: "#a9adb8",
  foreground: "#000000",
  muted: "#555555",
  star: "#c98a00",
};

type Font = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
};

// Tinos is a free serif drawn to the same measurements as Times New Roman,
// the site's own font. It's fetched once per server and reused.
let serifFonts: Promise<Font[]> | null = null;

export function loadSerifFonts(): Promise<Font[]> {
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
    console.error("Loading the share image font failed:", error);
    serifFonts = null;
    return [];
  });
  return serifFonts;
}

// The longest side of a picture drawn into a shared image. Bigger pictures
// can be too much data for the renderer to draw.
const PICTURE_SIDE = 600;

// A picture from the web as a still image, ready to convert: an animated GIF
// gives its first frame, a photo stored on its side is turned upright, and a
// big picture is shrunk to fit. Converting throws if it can't be read.
export async function stillImage(
  url: string,
  headers?: Record<string, string>,
): Promise<Sharp> {
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return sharp(Buffer.from(await res.arrayBuffer()))
    .autoOrient()
    .resize(PICTURE_SIDE, PICTURE_SIDE, {
      fit: "inside",
      withoutEnlargement: true,
    });
}

// An image as a still PNG data address the renderer can draw, or null when it
// can't be fetched or read. A big animated GIF would be too large to draw.
export async function embeddable(
  url: string,
  headers?: Record<string, string>,
): Promise<string | null> {
  try {
    const png = await (await stillImage(url, headers)).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

// A drawn image with its PNG stored as a palette of colours, which makes it
// about a third of the size with no difference anyone can see
export async function smallerPng(image: Response): Promise<Response> {
  const png = await sharp(Buffer.from(await image.arrayBuffer()))
    .png({ palette: true, quality: 90 })
    .toBuffer();
  const headers = new Headers(image.headers);
  headers.delete("Content-Length");
  return new Response(new Uint8Array(png), {
    status: image.status,
    headers,
  });
}

// A five-pointed star, or its left half
export function Star({ size, half = false }: { size: number; half?: boolean }) {
  const points = half
    ? "12,2 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
    : "12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26";

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <polygon points={points} fill={COLORS.star} />
    </svg>
  );
}

// Five-pointed stars for a rating out of 5, with a half star for .5
export function Stars({ rating, size }: { rating: number; size: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;

  return (
    <div style={{ display: "flex" }}>
      {Array.from({ length: full }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed-order list whose entries repeat
        <Star key={i} size={size} />
      ))}
      {half && <Star size={size} half />}
    </div>
  );
}

// The site's logo and name, which sign the bottom right of every shared
// image. Pushed to the far right of the row it sits in.
export function SiteSignature({ logo }: { logo: string | null }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginLeft: "auto",
        fontSize: 39,
        fontWeight: 700,
        color: COLORS.foreground,
      }}
    >
      {logo && (
        // biome-ignore lint/performance/noImgElement: drawn into a PNG, not shown on a page
        <img src={logo} alt="" width={68} height={68} />
      )}
      {SITE_NAME}
    </div>
  );
}
