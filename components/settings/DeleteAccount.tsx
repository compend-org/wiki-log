"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { deleteAccount } from "@/app/actions";
import { track } from "@/lib/analytics/analytics";
import { createClient } from "@/lib/supabase/client";

export default function DeleteAccount({ username }: { username: string }) {
  const t = useTranslations();
  const [confirmText, setConfirmText] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  async function handleDelete() {
    setBusy(true);
    setError("");
    const result = await deleteAccount();
    if (result.error) {
      setBusy(false);
      setError(result.error);
      return;
    }
    track("account_deleted");
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <section className="mt-8 flex flex-col gap-3 border-t border-line pt-6">
      <h2 className="text-xl font-bold">{t("settings.delete.title")}</h2>
      <p className="text-sm text-muted">
        {t.rich("settings.delete.warning", {
          username,
          b: (c) => <strong>{c}</strong>,
        })}
      </p>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={username}
        className="rounded-lg border border-line px-4 py-2 bg-surface text-foreground"
      />
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy || confirmText !== username}
        className="rounded-lg bg-danger px-4 py-2 text-background disabled:opacity-40"
      >
        {busy ? t("common.deleting") : t("settings.delete.confirm")}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
