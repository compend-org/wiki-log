import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";

// No page lives here, so rewriting to it serves the site's ordinary 404
const MISSING_PAGE = "/admin-page-that-does-not-exist";

function sessionClient(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    requireEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    requireEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
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

  return { supabase, response: () => supabaseResponse };
}

export async function updateSession(request: NextRequest) {
  const { supabase, response } = sessionClient(request);

  // Refreshes the session if needed. Don't remove this line.
  await supabase.auth.getClaims();

  return response();
}

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

// Answers with a real 404 status unless the visitor is an admin, which a page
// can't promise once it has started streaming. Looks in the table rather than
// the cached admin list, so removing an admin locks them out immediately, and
// any failure to confirm someone counts as "not an admin". This only hides the
// pages: the database functions behind them make their own check.
export async function adminOnly(request: NextRequest) {
  const { supabase, response } = sessionClient(request);

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (userId) {
    const { data: admin } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (admin) {
      const allowed = response();
      allowed.headers.set("cache-control", "private, no-store");
      return allowed;
    }
  }

  const missing = NextResponse.rewrite(new URL(MISSING_PAGE, request.url));
  // Someone whose session was just refreshed has to keep the new one, or
  // visiting this address would sign them out
  for (const cookie of response().cookies.getAll()) {
    missing.cookies.set(cookie);
  }
  missing.headers.set("cache-control", "private, no-store");
  return missing;
}
