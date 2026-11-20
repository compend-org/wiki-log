import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import {
  ListDraftCard,
  type ListDraftSummary,
  LogDraftCard,
  type LogDraftSummary,
} from "@/components/drafts/DraftCards";
import { loginHref } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Drafts" };

export default async function DraftsPage() {
  await connection();
  const t = await getTranslations();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect(loginHref("/drafts"));

  const { data, error } = await supabase.rpc("own_drafts");
  if (error) throw new Error(`Couldn't load your drafts: ${error.message}`);
  const { logs, lists } = data as {
    logs: LogDraftSummary[];
    lists: ListDraftSummary[];
  };
  const now = Date.now();
  const heading = "text-sm font-semibold uppercase tracking-wide text-muted";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">{t("drafts.title")}</h1>
      {logs.length === 0 && lists.length === 0 && (
        <p className="text-muted">{t("drafts.none")}</p>
      )}
      {logs.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className={heading}>
            {t("drafts.reviewsHeading", { count: logs.length })}
          </h2>
          {logs.map((draft) => (
            <LogDraftCard key={draft.item_id} draft={draft} now={now} />
          ))}
        </section>
      )}
      {lists.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className={heading}>
            {t("drafts.listsHeading", { count: lists.length })}
          </h2>
          {lists.map((draft) => (
            <ListDraftCard key={draft.id} draft={draft} now={now} />
          ))}
        </section>
      )}
    </main>
  );
}
