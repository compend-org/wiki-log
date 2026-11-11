import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import { supabaseUrl } from "@/lib/supabase/connection";
import { reportFailedResponses } from "@/lib/supabase/reportFailedResponses";

// Server-only. Bypasses RLS, so use it only in trusted server code.
export function createAdminClient() {
  return createClient(
    supabaseUrl(),
    requireEnv("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: reportFailedResponses },
    },
  );
}
