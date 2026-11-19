import Link from "next/link";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function ResetPasswordPage() {
  const t = await getTranslations();
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">{t("auth.reset.title")}</h1>
      {signedIn ? (
        <ResetPasswordForm />
      ) : (
        <p>
          {t.rich("auth.reset.invalidLink", {
            link: (c) => (
              <Link href="/forgot-password" className="underline">
                {c}
              </Link>
            ),
          })}
        </p>
      )}
    </main>
  );
}
