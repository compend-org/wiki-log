import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import Link from "next/link";
import { connection } from "next/server";

export const instant = false;

export default async function TestDb() {
  await connection();
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const email = claimsData?.claims?.email;

  const { data, error } = await supabase.from("videos").select("*");

  return (
    <main className="flex flex-col items-start gap-4 p-8">
      <pre>
        {error ? `Error: ${error.message}` : `videos rows: ${data.length}`}
      </pre>
      <pre>{email ? `Signed in as ${email}` : "Not signed in"}</pre>
      {email ? (
        <SignOutButton />
      ) : (
        <Link href="/login" className="underline">
          Go to login
        </Link>
      )}
    </main>
  );
}