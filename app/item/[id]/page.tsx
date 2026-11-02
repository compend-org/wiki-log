import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getItemForPage } from "@/lib/items";
import { parseLimit } from "@/lib/paging";
import { CONTACT_EMAIL } from "@/lib/site";
import AddToList from "@/components/AddToList";
import ItemImage from "@/components/ItemImage";
import LogForm from "@/components/LogForm";
import MyEntries, { type MyEntry } from "@/components/MyEntries";
import ItemLogs from "@/components/ItemLogs";

export const instant = false;

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

  const result = await getItemForPage(id);
  if ("error" in result) notFound();
  const { item } = result;

  // The viewer's own earlier entries for this item
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId: string | undefined = claimsData?.claims?.sub;

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

  const removalLink = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    `Image removal request: ${item.title} (${item.id})`
  )}`;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-3">
        {item.imageUrl ? (
          <figure className="flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt={item.title}
              className={
                item.imageNonFree
                  ? "max-h-72 w-auto max-w-[330px] self-start object-contain"
                  : "max-h-96 w-full object-contain"
              }
            />
            <figcaption className="text-xs text-muted">
              {item.imageNonFree ? (
                <>
                  Non-free image from Wikipedia, shown at low resolution for
                  review and commentary
                  {item.imageFilePage && (
                    <>
                      {" "}
                      (
                      <a href={item.imageFilePage} className="underline">
                        source and rights
                      </a>
                      )
                    </>
                  )}
                  . Rights holder?{" "}
                  <a href={removalLink} className="underline">
                    Request removal
                  </a>
                  .
                </>
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
        <p className="text-xs text-muted">
          From{" "}
          <a href={item.pageUrl} className="underline">
            Wikipedia
          </a>
          , licensed CC BY-SA 4.0.
        </p>
      </div>

      <AddToList itemId={id} title={item.title} imageUrl={item.imageUrl} />
      <LogForm id={id} alreadyLogged={myEntries.length > 0} />
      <MyEntries entries={myEntries} />
      <ItemLogs itemId={id} limit={parseLimit(limit)} />
    </main>
  );
}