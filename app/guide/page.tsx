import { useTranslations } from "next-intl";
import { SITE_NAME } from "@/lib/site";

export const metadata = { title: "Style Guide" };

export default function GuidePage() {
  const t = useTranslations();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-4 leading-relaxed sm:p-8">
      <h1 className="text-3xl font-bold">{t("footer.styleGuide")}</h1>

      <p>
        {t.rich("guide.welcome", {
          b: (c) => <strong>{c}</strong>,
          site: SITE_NAME,
        })}
      </p>

      <p>{t("guide.thatSAboutTheOnly")}</p>

      <p>{t("guide.theDiaristChronicallyAppraisesExperience")}</p>

      <p>{t("guide.theCodifierIsMoreConcerned")}</p>

      <p>{t("guide.neitherOfThesePeopleExist")}</p>
    </main>
  );
}
