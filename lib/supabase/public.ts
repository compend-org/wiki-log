// ABOUTME: A Supabase client that reads as an anonymous visitor, with no cookies.
// ABOUTME: Works anywhere on the server, including cached functions.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import { reportFailedResponses } from "@/lib/supabase/reportFailedResponses";

export function createPublicClient(): SupabaseClient {
  return createClient(
    requireEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    requireEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
    { global: { fetch: reportFailedResponses } },
  );
}
