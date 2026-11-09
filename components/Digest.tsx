// ABOUTME: The Digest page's list of long reviews, a page at a time.
// ABOUTME: Renders the first page on the server; DigestPages adds later pages below.
import { connection } from "next/server";
import DigestPages from "@/components/DigestPages";
import { loadDigestPage } from "@/components/loadDigestPage";

export default async function Digest() {
  await connection();
  const page = await loadDigestPage(null);

  if (page.error) {
    return <p className="text-center text-danger">{page.error}</p>;
  }
  if (page.cards.length === 0 && !page.next) {
    return <p className="py-12 text-center text-muted">No long reviews yet.</p>;
  }

  return <DigestPages first={page} />;
}
