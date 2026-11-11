// ABOUTME: The Supabase project URL and publishable key, read from the environment.
// ABOUTME: Safe in the browser: each NEXT_PUBLIC_ variable is written out so Next.js inlines it.
import { requireEnv } from "@/lib/env";

export function supabaseUrl(): string {
  return requireEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

export function supabasePublishableKey(): string {
  return requireEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
