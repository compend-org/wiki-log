import { useTranslations } from "next-intl";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  const t = useTranslations();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">{t("footer.contact")}</h1>
      <p>
        {t.rich("pages.contact.reachMe", {
          mail: (c) => (
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
              {c}
            </a>
          ),
          email: CONTACT_EMAIL,
        })}
      </p>

      {/* <section className="flex flex-col gap-1">
                <h2 className="text-xl font-bold">What to write about</h2>
                <ul className="list-disc pl-5">
                    <li>Questions, bug reports and suggestions.</li>
                    <li>
                        A review, comment, list, profile picture or compound that breaks
                        the law or that you think should be removed. Say where it is (a
                        link is ideal) and what&apos;s wrong with it.
                    </li>
                    <li>
                        Pictures: if you hold the rights to an image shown here and want
                        it taken down, include the item&apos;s address. There&apos;s also a
                        Request removal link under each picture.
                    </li>
                    <li>
                        Your data: to see, correct or delete what we hold about you. You
                        can also delete your account yourself from Settings.
                    </li>
                </ul>
            </section> */}

      <p className="text-sm text-muted">
        {t("pages.contact.disclaimer", { site: SITE_NAME })}
      </p>
    </main>
  );
}
