import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import { reportFailedResponses } from "@/lib/supabase/reportFailedResponses";

// Server-only. Bypasses RLS, so use it only in trusted server code.
export function createAdminClient() {
  return createClient(
    requireEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    requireEnv("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: reportFailedResponses },
    },
  );
}
