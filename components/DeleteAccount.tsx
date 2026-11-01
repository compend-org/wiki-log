"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deleteAccount } from "@/app/actions";

export default function DeleteAccount({ username }: { username: string }) {
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
        await createClient().auth.signOut();
        router.push("/");
        router.refresh();
    }

    return (
        <section className="mt-8 flex flex-col gap-3 border-t border-line pt-6">
            <h2 className="text-xl font-bold">Delete account</h2>
            <p className="text-sm text-muted">
                This permanently deletes your account, your profile, all your logs and
                reviews, and your follows. It can&apos;t be undone. Type your username
                (<strong>{username}</strong>) to confirm.
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
                {busy ? "Deleting…" : "Delete my account"}
            </button>
            {error && <p className="text-sm text-danger">{error}</p>}
        </section>
    );
}