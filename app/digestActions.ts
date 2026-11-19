// ABOUTME: Server action that loads the next page of the Digest.
// ABOUTME: Checks what the browser sent, then renders the page's cards for the viewer.
"use server";

import { getTranslations } from "next-intl/server";
import {
  type DigestPage,
  loadDigestPage,
} from "@/components/feed/loadDigestPage";
import { parseDigestCursor } from "@/lib/feed/digest";

export async function loadMoreDigest(cursor: unknown): Promise<DigestPage> {
  const t = await getTranslations();
  const parsed = parseDigestCursor(cursor);
  if (parsed === undefined) throw new Error(t("errors.notAPageOfDigest"));
  return loadDigestPage(parsed);
}
