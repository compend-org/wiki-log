import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import CompoundCreator from "@/components/CompoundCreator";
import { FEATURES } from "@/lib/features";
import { loginHref } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function CraftPage() {
  if (!FEATURES.compounds) notFound();

  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(loginHref("/craft"));

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Craft a compound</h1>
      <p className="text-sm text-muted">
        Combine two or more items into something new, give it a name, and it
        becomes an item of its own that anyone can review and add to lists.
      </p>
      <CompoundCreator />
    </main>
  );
}
