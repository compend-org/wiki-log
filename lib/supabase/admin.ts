import { createClient } from "@supabase/supabase-js";

// Server-only. Bypasses RLS, so use it only in trusted server code.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}