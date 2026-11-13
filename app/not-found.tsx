// 404 page. Should add a graphic at some point.
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p>That page doesn&apos;t exist, or it has been removed.</p>
    </main>
  );
}
