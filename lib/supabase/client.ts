import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/connection";
import { reportFailedResponses } from "@/lib/supabase/reportFailedResponses";

export function createClient() {
  return createBrowserClient(supabaseUrl(), supabasePublishableKey(), {
    global: { fetch: reportFailedResponses },
  });
}
