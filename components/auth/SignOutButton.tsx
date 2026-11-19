"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import SignOutIcon from "@/components/auth/SignOutIcon";
import { track } from "@/lib/analytics/analytics";
import { createClient } from "@/lib/supabase/client";

// The caller chooses the display (for example "inline-flex" or
// "hidden sm:inline-flex") and whether the words show at every size.
export default function SignOutButton({
  className = "",
  labelClassName = "",
  label: labelProp,
}: {
  className?: string;
  labelClassName?: string;
  label?: string;
}) {
  const t = useTranslations();
  const label = labelProp ?? t("common.signOut");
  const router = useRouter();

  async function handleSignOut() {
    track("signed_out");
    await createClient().auth.signOut({ scope: "local" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      aria-label={label}
      title={label}
      className={`items-center gap-1.5 text-accent hover:text-foreground ${className}`}
    >
      <SignOutIcon className="h-5 w-5" />
      <span className={labelClassName}>{label}</span>
    </button>
  );
}
