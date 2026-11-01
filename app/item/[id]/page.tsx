import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getItemById } from "@/lib/wikipedia";
import { parseLimit } from "@/lib/paging";
import LogForm from "@/components/LogForm";
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

  const result = await getItemById(id);
  if ("error" in result) notFound();
  const { item } = result;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-3">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title}
            className="max-h-96 w-full rounded-lg object-contain"
          />
        ) : (
          <div className="aspect-video w-full rounded-lg bg-surface" />
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

      <LogForm id={id} />
      <ItemLogs itemId={id} limit={parseLimit(limit)} />
    </main>
  );
}