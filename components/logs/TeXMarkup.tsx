"use client";

import "katex/dist/katex.min.css";
import katex from "katex";

// The tallest a piece of math may be, in ems; a twenty-row matrix is about
// 24. Text raised or lowered by thousands of ems, as \raisebox{-999999em}{}
// does, would stretch the page to millions of pixels, so such math shows as
// written instead.
const MAX_HEIGHT = 50;

// The colour KaTeX shows TeX it can't read in
const ERROR_COLOR = "#cc0000";

// TeX math, on its own line when `block`. TeX that doesn't parse, or that is
// too tall to show, shows as written, in red. The math is clipped to its own
// box, so raised or shifted parts can't cover the rest of the page.
export default function TeX({ tex, block }: { tex: string; block: boolean }) {
  const drawn = katex.renderToString(tex, {
    displayMode: block,
    throwOnError: false,
  });
  const html = tallest(drawn) > MAX_HEIGHT ? asWritten(tex) : drawn;
  const Tag = block ? "div" : "span";
  return (
    <Tag
      className={
        block ? "overflow-x-auto" : "inline-block max-w-full contain-paint"
      }
      // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX's own markup, with the commands that link elsewhere or add raw HTML turned off
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// How tall KaTeX's drawing is, in ems: each run of math it may break a line
// between starts with a strut as tall as the run, above and below its line
function tallest(html: string): number {
  const heights = Array.from(
    html.matchAll(/class="katex-strut" style="height:([\d.]+)em/g),
    (match) => Number(match[1]),
  );
  return Math.max(0, ...heights);
}

// The TeX as written, in red, as KaTeX shows TeX it can't read
function asWritten(tex: string): string {
  const escaped = tex
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  return `<span class="katex-error" title="Too tall to show" style="color:${ERROR_COLOR}">${escaped}</span>`;
}
