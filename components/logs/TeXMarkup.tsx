"use client";

import "katex/dist/katex.min.css";
import katex from "katex";

// TeX math, on its own line when `block`. TeX that doesn't parse shows as
// written, in red. The math is clipped to its own box, so raised or shifted
// parts can't cover the rest of the page.
export default function TeX({ tex, block }: { tex: string; block: boolean }) {
  const html = katex.renderToString(tex, {
    displayMode: block,
    throwOnError: false,
  });
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
