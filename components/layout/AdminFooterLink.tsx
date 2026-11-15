// ABOUTME: Footer link to the admin pages, shown only to site admins.
// ABOUTME: Reads the signed-in user on the server, so render it inside a Suspense boundary.
import Link from "next/link";
import { connection } from "next/server";
import { isAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AdminFooterLink() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!(await isAdmin(data?.claims?.sub))) return null;

  return (
    <Link
      href="/admin/reports"
      prefetch={false}
      className="hover:text-foreground hover:underline"
    >
      Admin
    </Link>
  );
}
