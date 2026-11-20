"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

// Loaded only on pages with math in them
const TeXMarkup = dynamic(() => import("./TeXMarkup"));

// TeX math, on its own line when `block`. Until the math can be drawn, the
// TeX shows as written, and the rest of the page stays as it is.
export default function TeX({ tex, block }: { tex: string; block: boolean }) {
  const Tag = block ? "div" : "span";
  return (
    <Suspense fallback={<Tag>{tex}</Tag>}>
      <TeXMarkup tex={tex} block={block} />
    </Suspense>
  );
}
