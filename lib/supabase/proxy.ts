import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // biome-ignore lint/suspicious/useIterableCallbackReturn: the callback's return value is unused
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          // biome-ignore lint/suspicious/useIterableCallbackReturn: the callback's return value is unused
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
          // Stops CDNs storing a response that carries someone's session
          for (const [key, value] of Object.entries(headers)) {
            supabaseResponse.headers.set(key, value);
          }
        },
      },
    },
  );

  // Refreshes the session if needed. Don't remove this line.
  await supabase.auth.getClaims();

  return supabaseResponse;
}
