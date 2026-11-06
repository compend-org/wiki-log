import { createBrowserClient } from "@supabase/ssr";
import { reportFailedResponses } from "@/lib/supabase/reportFailedResponses";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { global: { fetch: reportFailedResponses } },
  );
}
