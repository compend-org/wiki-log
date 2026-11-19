import Link from "next/link";
import { useTranslations } from "next-intl";

export default function AuthErrorPage() {
  const t = useTranslations();
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-3 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">{t("auth.linkError.title")}</h1>
      <p>
        {t.rich("auth.linkError.body", {
          signin: (c) => (
            <Link href="/login" className="underline">
              {c}
            </Link>
          ),
          reset: (c) => (
            <Link href="/forgot-password" className="underline">
              {c}
            </Link>
          ),
        })}
      </p>
    </main>
  );
}
