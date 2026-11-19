import { useTranslations } from "next-intl";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  const t = useTranslations();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">{t("footer.privacy")}</h1>
      <p className="leading-relaxed">
        {t.rich("pages.privacy.body", {
          b: (c) => <strong>{c}</strong>,
          site: SITE_NAME,
          mail: (c) => (
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
              {c}
            </a>
          ),
          email: CONTACT_EMAIL,
        })}
      </p>
    </main>
  );
}
