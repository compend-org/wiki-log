import Link from "next/link";
import { connection } from "next/server";
import ResetPasswordForm from "@/components/ResetPasswordForm";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function ResetPasswordPage() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col justify-center gap-4 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Choose a new password</h1>
      {signedIn ? (
        <ResetPasswordForm />
      ) : (
        <p>
          This link is invalid or has expired.{" "}
          <Link href="/forgot-password" className="underline">
            Request a new one
          </Link>
          .
        </p>
      )}
    </main>
  );
}
