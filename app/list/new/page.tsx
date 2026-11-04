import { redirect } from "next/navigation";
import { connection } from "next/server";
import NewListForm from "@/components/NewListForm";
import { loginHref } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function NewListPage() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(loginHref("/list/new"));

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">New list</h1>
      <NewListForm />
    </main>
  );
}
