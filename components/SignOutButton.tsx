"use client";

import { useRouter } from "next/navigation";
import SignOutIcon from "@/components/SignOutIcon";
import { createClient } from "@/lib/supabase/client";

// The caller chooses the display (for example "inline-flex" or
// "hidden sm:inline-flex") and whether the words show at every size.
export default function SignOutButton({
  className = "",
  labelClassName = "",
  label = "Sign out",
}: {
  className?: string;
  labelClassName?: string;
  label?: string;
}) {
  const router = useRouter();

  async function handleSignOut() {
    await createClient().auth.signOut();
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
