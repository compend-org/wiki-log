import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import CompoundCreator from "@/components/craft/CompoundCreator";
import { FEATURES } from "@/lib/features";
import { loginHref } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function CraftPage() {
  const t = await getTranslations();
  if (!FEATURES.compounds) notFound();

  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(loginHref("/craft"));

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">{t("nav.craft")}</h1>
      <p className="text-sm text-muted">{t("craft.combineTwoOrMoreItems")}</p>
      <CompoundCreator />
    </main>
  );
}
