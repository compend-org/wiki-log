// ABOUTME: Tells which people are site admins, as recorded in public.admins.
// ABOUTME: Server-only; looks the admins up at most once per request.
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";

// Who gets the admin badge and the admin tools
export const getAdminIds = cache(async (): Promise<Set<string>> => {
  const { data } = await createPublicClient().from("admins").select("user_id");
  return new Set((data ?? []).map((row) => row.user_id as string));
});

export async function isAdmin(
  userId: string | null | undefined,
): Promise<boolean> {
  return Boolean(userId) && (await getAdminIds()).has(userId as string);
}
