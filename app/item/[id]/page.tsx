import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import AddToList from "@/components/AddToList";
import ItemImage from "@/components/ItemImage";
import ItemLists from "@/components/ItemLists";
import ItemLogs from "@/components/ItemLogs";
import LogForm from "@/components/LogForm";
import MyEntries, { type MyEntry } from "@/components/MyEntries";
import RatingHistogram from "@/components/RatingsHistogram";
import { BUSY_ERROR } from "@/lib/articleSummary";
import { FEATURES } from "@/lib/features";
import { isCompoundId } from "@/lib/ids";
import { getItemForPage } from "@/lib/items";
import { pageMetadata } from "@/lib/metadata";
import { parseLimit } from "@/lib/paging";
import { CONTACT_EMAIL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type Part = { id: string; title: string; imageUrl: string | null };

// Cached per request, so the page and its metadata share one lookup
const getItem = cache(getItemForPage);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  await connection();
  const { id } = await params;
  if (isCompoundId(id) && !FEATURES.compounds) return {};
  const result = await getItem(id);
  if ("error" in result) return {};

  const { item } = result;
  return pageMetadata({
    title: item.title,
    image: item.imageUrl,
  });
}

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ limit?: string }>;
}) {
  await connection();
  const { id } = await params;
  const { limit } = await searchParams;

  const result = await getItem(id);
  if (isCompoundId(id) && !FEATURES.compounds) notFound();
  if ("error" in result) {
    if (result.error !== BUSY_ERROR) notFound();
    // The item may well exist: Wikipedia just didn't answer in time
    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-3 p-4 sm:p-8">
        <h1 className="text-3xl font-bold">Wikipedia is busy</h1>
        <p>
          We couldn&apos;t load this item from Wikipedia just now. Try again in
          a minute.
        </p>
      </main>
    );
  }
  const { item } = result;

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId: string | undefined = claimsData?.claims?.sub;

  // The viewer's own earlier entries for this item
  let myEntries: MyEntry[] = [];
  if (viewerId) {
    const { data } = await supabase
      .from("logs")
      .select("id, rating, review, logged_at")
      .eq("user_id", viewerId)
      .eq("item_id", id)
      .order("logged_at", { ascending: false });
    myEntries = (data ?? []).map((r) => ({
      id: r.id,
      rating: Number(r.rating ?? 0),
      review: r.review,
      loggedAt: r.logged_at,
    }));
  }

  // Everyone's latest rating of this item, one per person, for the histogram
  const { data: ratingRows } = await supabase
    .from("logs")
    .select("user_id, rating")
    .eq("item_id", id)
    .not("rating", "is", null)
    .order("logged_at", { ascending: false });
  const latestRating = new Map<string, number>();
  for (const r of (ratingRows ?? []) as {
    user_id: string;
    rating: number | string;
  }[]) {
    if (!latestRating.has(r.user_id)) {
      latestRating.set(r.user_id, Number(r.rating));
    }
  }
  // The viewer's own latest rating (entries are newest first; 0 means none)
  const myRating = myEntries.find((e) => e.rating > 0)?.rating ?? null;

  // For a compound: who made it, and from what
  const compound = isCompoundId(id);
  let madeFrom: Part[] = [];
  let creator: string | null = null;
  let createdAt: string | null = null;

  if (compound) {
    const { data: c } = await supabase
      .from("compounds")
      .select("creator_id, created_at")
      .eq("item_id", id)
      .maybeSingle();
    createdAt = c?.created_at ?? null;

    const { data: partRows } = await supabase
      .from("compound_parts")
      .select("part_id, position")
      .eq("compound_id", id)
      .order("position");
    const partIds = (partRows ?? []).map((r) => r.part_id as string);

    if (partIds.length > 0) {
      const { data: partItems } = await supabase
        .from("items")
        .select("id, title, image_url")
        .in("id", partIds);
      const byId = new Map((partItems ?? []).map((i) => [i.id as string, i]));
      madeFrom = partIds.flatMap((pid) => {
        const it = byId.get(pid);
        return it ? [{ id: pid, title: it.title, imageUrl: it.image_url }] : [];
      });
    }

    if (c?.creator_id) {
      const { data: p } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", c.creator_id)
        .maybeSingle();
      creator = p?.username ?? null;
    }
  }

  // Compounds that use this item as an ingredient
  const { data: usedRows } = FEATURES.compounds
    ? await supabase
        .from("compound_parts")
        .select("compound_id")
        .eq("part_id", id)
        .limit(12)
    : { data: null };
  const usedIds = (usedRows ?? []).map((r) => r.compound_id as string);
  let usedIn: { id: string; title: string }[] = [];
  if (usedIds.length > 0) {
    const { data: ci } = await supabase
      .from("items")
      .select("id, title")
      .in("id", usedIds);
    usedIn = (ci ?? []) as { id: string; title: string }[];
  }

  const removalLink = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    `Image removal request: ${item.title} (${item.id})`,
  )}`;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          {item.imageUrl ? (
            <figure className="flex flex-col items-center gap-1">
              {/* biome-ignore lint/performance/noImgElement: a plain img is intended */}
              <img
                src={item.imageUrl}
                alt={item.title}
                className="item-img h-auto w-auto max-w-full border-2 border-dashed border-line bg-clip-padding [[data-theme=dark]_&]:bg-foreground"
              />
              <figcaption className="text-center text-xs text-muted">
                {item.imageNonFree ? (
                  <a href={removalLink} className="underline">
                    Request removal
                  </a>
                ) : (
                  <>
                    Image:{" "}
                    {item.imageFilePage ? (
                      <a href={item.imageFilePage} className="underline">
                        Wikimedia Commons
                      </a>
                    ) : (
                      "Wikimedia Commons"
                    )}
                  </>
                )}
              </figcaption>
            </figure>
          ) : (
            <ItemImage
              src={null}
              alt={item.title}
              className="aspect-video max-h-80 w-full"
            />
          )}

          <h1 className="text-3xl font-bold">{item.title}</h1>
          {item.description && <p className="text-muted">{item.description}</p>}

          {compound ? (
            <p className="text-xs text-muted">
              A compound
              {creator && (
                <>
                  {" "}
                  crafted by{" "}
                  <Link
                    href={`/u/${encodeURIComponent(creator)}`}
                    className="underline"
                  >
                    {creator}
                  </Link>
                </>
              )}
              {createdAt && <> on {createdAt.slice(0, 10)}</>}.
            </p>
          ) : (
            <p className="text-xs text-muted">
              From{" "}
              <a
                href={item.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Wikipedia
              </a>
              , licensed CC BY-SA 4.0.
            </p>
          )}
        </div>

        {compound && madeFrom.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Made from
            </h2>
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {madeFrom.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/item/${p.id}`}
                    className="flex flex-col gap-1 no-underline"
                  >
                    <ItemImage
                      src={p.imageUrl}
                      alt={p.title}
                      className="aspect-square w-full"
                    />
                    <span className="truncate text-xs">{p.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {usedIn.length > 0 && (
          <section className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Used in
            </h2>
            <p className="text-sm">
              {usedIn.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && ", "}
                  <Link href={`/item/${c.id}`} className="underline">
                    {c.title}
                  </Link>
                </span>
              ))}
            </p>
          </section>
        )}

        <AddToList itemId={id} title={item.title} imageUrl={item.imageUrl} />
        <div id="log" className="scroll-mt-4">
          <LogForm id={id} alreadyLogged={myEntries.length > 0} />
        </div>
        <MyEntries entries={myEntries} />
        <RatingHistogram
          ratings={[...latestRating.values()]}
          highlight={myRating}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0">
          <ItemLogs itemId={id} limit={parseLimit(limit)} />
        </div>
        <div className="min-w-0">
          <ItemLists itemId={id} />
        </div>
      </div>
    </main>
  );
}
