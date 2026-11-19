import { useTranslations } from "next-intl";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  const t = useTranslations();
  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">{t("auth.forgot.title")}</h1>
      <ForgotPasswordForm />
    </main>
  );
}
