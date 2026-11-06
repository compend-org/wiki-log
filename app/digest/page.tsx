// ABOUTME: The Digest page, which lists only long reviews (over 720 characters), newest first.
// ABOUTME: Not linked from anywhere yet; it is reached at /digest.
import { Suspense } from "react";
import Digest from "@/components/Digest";

export const metadata = { title: "Digest" };
export const instant = false;

export default function DigestPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">Digest</h1>
        <p className="text-sm text-muted">Longer reviews, newest first.</p>
      </header>

      <Suspense
        fallback={<p className="py-12 text-center text-muted">Loading…</p>}
      >
        <Digest />
      </Suspense>
    </main>
  );
}
