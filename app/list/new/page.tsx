import { redirect } from "next/navigation";
import { connection } from "next/server";
import ListCreator from "@/components/lists/ListCreator";
import { isUuid } from "@/lib/ids";
import { getListDraft } from "@/lib/lists/listDrafts";
import { addParam, fetchNewListItem } from "@/lib/lists/newListItem";
import { loginHref } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

// ?add=Q42 starts the list with that item, which is what "New list" in an
// item's "Add to list" sends. ?draft= carries on with a saved draft.
export default async function NewListPage({
  searchParams,
}: {
  searchParams: Promise<{
    add?: string | string[];
    draft?: string | string[];
  }>;
}) {
  await connection();
  const params = await searchParams;
  const add = addParam(params.add);
  const draftId = typeof params.draft === "string" ? params.draft : null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    redirect(
      loginHref(
        draftId
          ? `/list/new?draft=${encodeURIComponent(draftId)}`
          : add
            ? `/list/new?add=${encodeURIComponent(add)}`
            : "/list/new",
      ),
    );
  }

  // A draft that was deleted or made into a list leaves an empty form
  const draft =
    draftId && isUuid(draftId) ? await getListDraft(supabase, draftId) : null;
  if (params.draft !== undefined && !draft) redirect("/list/new");
  const entry = draft ? null : await fetchNewListItem(supabase, add);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      {/* Kept mounted while hidden, so it starts over when the page brings a
          draft saved since */}
      <ListCreator
        key={draft ? `${draft.id}:${draft.savedAt}` : `new:${add ?? ""}`}
        firstItem={entry}
        draft={draft}
      />
    </main>
  );
}
