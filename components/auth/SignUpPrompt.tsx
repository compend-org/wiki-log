// ABOUTME: Invites signed-out visitors to create an account, with a sign-in link for those who have one.
// ABOUTME: Both links bring the visitor back to the page they were on.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { loginHref, signUpHref } from "@/lib/redirect";

export default function SignUpPrompt({ reason }: { reason: string }) {
  const pathname = usePathname() || "/";

  return (
    <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm">{reason}</p>
      <div className="flex shrink-0 items-center gap-4">
        <Link
          href={signUpHref(pathname)}
          prefetch={false}
          className="bg-accent px-4 py-2 text-sm text-background hover:no-underline"
        >
          Create an account
        </Link>
        <Link
          href={loginHref(pathname)}
          prefetch={false}
          className="text-sm underline"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
