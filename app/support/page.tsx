import { useTranslations } from "next-intl";
import { KOFI_URL } from "@/lib/site";

export const metadata = { title: "Support" };

export default function SupportPage() {
  const t = useTranslations();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">{t("footer.donate")}</h1>
      <p>{t("support.serverCostsAreScary")}</p>
      <p>
        <a
          href={KOFI_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded border-2 border-dashed border-accent px-4 py-2 font-semibold hover:underline"
        >
          {t("pages.support.kofi")}
        </a>
      </p>
    </main>
  );
}
