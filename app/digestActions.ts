// ABOUTME: Server action that loads the next page of the Digest.
// ABOUTME: Checks what the browser sent, then renders the page's cards for the viewer.
"use server";

import { type DigestPage, loadDigestPage } from "@/components/Digest";
import { parseDigestCursor } from "@/lib/digest";

export async function loadMoreDigest(cursor: unknown): Promise<DigestPage> {
  const parsed = parseDigestCursor(cursor);
  if (parsed === undefined) throw new Error("That isn't a page of the digest.");
  return loadDigestPage(parsed);
}