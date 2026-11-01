"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getVideoId } from "@/lib/youtube";

export default function LogLinkForm() {
  const [link, setLink] = useState<string>("");
  const [error, setError] = useState<string>("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const id = getVideoId(link);
    if (!id) {
      setError("That doesn't look like a YouTube link.");
      return;
    }
    router.push(`/video/${id}`);
  }

  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-3xl font-bold">Log a video</h1>
      <form onSubmit={handleSubmit} className="flex w-full gap-2">
        <input
          type="text"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Paste a YouTube link"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-4 py-2 text-foreground"
        />
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-background"
        >
          Log it
        </button>
      </form>
      {error && <p className="text-danger">{error}</p>}
    </section>
  );
}