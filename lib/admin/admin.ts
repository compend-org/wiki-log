// ABOUTME: Tells which people are site admins, as recorded in public.admins.
// ABOUTME: Server-only; the admin list is cached in the shared remote cache for all server instances.
import { cacheLife } from "next/cache";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";

// The user ids in public.admins. Returns an array because the remote cache
// stores plain serializable values.
async function listAdminIds(): Promise<string[]> {
  // The remote cache is shared by every server instance, so admins are looked
  // up about once per 5 minutes (300 seconds) in total, not once per request.
  // A change to public.admins can take that long to show up. The numbers must
  // be written out here as plain values.
  "use cache: remote";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

  const { data } = await createPublicClient().from("admins").select("user_id");
  return (data ?? []).map((row) => row.user_id as string);
}

// Who gets the admin badge and the admin tools
export const getAdminIds = cache(
  async (): Promise<Set<string>> => new Set(await listAdminIds()),
);

export async function isAdmin(
  userId: string | null | undefined,
): Promise<boolean> {
  return Boolean(userId) && (await getAdminIds()).has(userId as string);
}
