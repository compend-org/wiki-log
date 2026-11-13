// ABOUTME: A Supabase client that reads as an anonymous visitor, with no cookies.
// ABOUTME: Works anywhere on the server, including cached functions.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/connection";
import { reportFailedResponses } from "@/lib/supabase/reportFailedResponses";

export function createPublicClient(): SupabaseClient {
  return createClient(supabaseUrl(), supabasePublishableKey(), {
    global: { fetch: reportFailedResponses },
  });
}
