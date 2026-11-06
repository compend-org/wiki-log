import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { reportFailedResponses } from "@/lib/supabase/reportFailedResponses";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { fetch: reportFailedResponses },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            // biome-ignore lint/suspicious/useIterableCallbackReturn: the callback's return value is unused
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies can't be set.
            // Safe to ignore, because the proxy below refreshes the session.
          }
        },
      },
    },
  );
}
