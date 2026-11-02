import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/redirect";
import LoginForm from "@/components/LoginForm";

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

  // Already signed in: go straight on
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect(target);

  return <LoginForm next={target} />;
}