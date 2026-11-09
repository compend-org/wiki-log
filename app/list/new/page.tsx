import { redirect } from "next/navigation";
import { connection } from "next/server";
import ListEditor from "@/components/ListEditor";
import { loginHref } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function NewListPage() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(loginHref("/list/new"));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <ListEditor
        list={{ id: null, title: "", description: null, ranked: false }}
        ownerName=""
        initialItems={[]}
      />
    </main>
  );
}