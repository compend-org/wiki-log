import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getItemById } from "@/lib/wikipedia";

export const instant = false;

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;

  const result = await getItemById(id);
  if ("error" in result) notFound();
  const { item } = result;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
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
    </main>
  );
}