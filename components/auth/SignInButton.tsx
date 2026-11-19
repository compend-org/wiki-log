"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import SignInIcon from "@/components/auth/SignInIcon";
import { useLoginHref } from "@/lib/hooks/useLoginHref";

export default function SignInButton({
  className = "",
  labelClassName = "",
  label: labelProp,
}: {
  className?: string;
  labelClassName?: string;
  label?: string;
}) {
  const t = useTranslations();
  const label = labelProp ?? t("common.signIn");
  const loginHref = useLoginHref();

  return (
    <Link
      href={loginHref}
      aria-label={label}
      title={label}
      prefetch={false}
      className={`items-center gap-1.5 text-accent hover:text-foreground ${className}`}
    >
      <SignInIcon className="h-5 w-5" />
      <span className={labelClassName}>{label}</span>
    </Link>
  );
}
