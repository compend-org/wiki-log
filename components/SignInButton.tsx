"use client";

import Link from "next/link";
import SignInIcon from "@/components/SignInIcon";
import { useLoginHref } from "@/lib/useLoginHref";

export default function SignInButton({
  className = "",
  labelClassName = "",
  label = "Sign in",
}: {
  className?: string;
  labelClassName?: string;
  label?: string;
}) {
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
