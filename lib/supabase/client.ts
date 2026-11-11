import { createBrowserClient } from "@supabase/ssr";
import { requireEnv } from "@/lib/env";
import { reportFailedResponses } from "@/lib/supabase/reportFailedResponses";

export function createClient() {
  return createBrowserClient(
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
