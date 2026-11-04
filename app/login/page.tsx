import { redirect } from "next/navigation";
import { connection } from "next/server";
import LoginForm from "@/components/LoginForm";
import { safeNext } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await connection();
  const { next } = await searchParams;

  let target = safeNext(next);
  if (target.startsWith("/login")) target = "/";

  // Already signed in? Ask the server, not just the cookie, so a leftover
  // session for a deleted account doesn't count
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect(target);

  return <LoginForm next={target} />;
}
