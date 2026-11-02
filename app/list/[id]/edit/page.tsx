import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/ids";
import ListEditor, { type ListEntry } from "@/components/ListEditor";

export const instant = false;

type ListRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  ranked: boolean;
  profiles: { username: string } | null;
};

type EntryRow = {
  item_id: string;
  items: { title: string; image_url: string | null } | null;
};

export default async function EditListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId: string | undefined = claimsData?.claims?.sub;
  if (!viewerId) redirect("/login");

  const { data } = await supabase
    .from("lists")
    .select(
      "id, user_id, title, description, ranked, profiles!lists_user_id_profiles_fkey(username)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const list = data as unknown as ListRow;

  // Only the owner edits
  if (list.user_id !== viewerId) redirect(`/list/${id}`);

  const { data: entryData } = await supabase
    .from("list_items")
    .select("item_id, items(title, image_url)")
    .eq("list_id", id)
    .order("position");

  const initialItems: ListEntry[] = (
    (entryData ?? []) as unknown as EntryRow[]
  ).map((e) => ({
    itemId: e.item_id,
    title: e.items?.title ?? "Unknown item",
    imageUrl: e.items?.image_url ?? null,
  }));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <ListEditor
        list={{
          id: list.id,
          title: list.title,
          description: list.description,
          ranked: list.ranked,
        }}
        ownerName={list.profiles?.username ?? ""}
        initialItems={initialItems}
      />
    </main>
  );
}