"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SignOutIcon from "@/components/SignOutIcon";

export default function SignOutButton({ className = "" }: { className?: string }) {
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
      className={`inline-flex items-center gap-1.5 text-accent underline hover:no-underline ${className}`}
    >
      <SignOutIcon className="h-5 w-5" />
    </button>
  );
}