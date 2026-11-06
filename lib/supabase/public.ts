// ABOUTME: A Supabase client that reads as an anonymous visitor, with no cookies.
// ABOUTME: Works anywhere on the server, including cached functions.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { reportFailedResponses } from "@/lib/supabase/reportFailedResponses";

export function createPublicClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { global: { fetch: reportFailedResponses } },
  );
}
