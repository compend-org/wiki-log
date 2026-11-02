import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getItemForPage } from "@/lib/items";
import { parseLimit } from "@/lib/paging";
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
      rating: Number(r.rating),
      review: r.review,
      loggedAt: r.logged_at,
    }));
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-3">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title}
            className="max-h-96 w-full object-contain"
          />
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
      <LogForm id={id} />
      <MyEntries entries={myEntries} />
      <ItemLogs itemId={id} limit={parseLimit(limit)} />
    </main>
  );
}