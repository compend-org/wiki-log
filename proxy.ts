// ABOUTME: Refreshes a signed-in visitor's Supabase session cookie before their request is handled.
// ABOUTME: Runs only for page requests that carry a session cookie, never for prefetches or static files.
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      // The proxy runs ahead of the CDN cache, so every match is a function
      // call. Signed-out visitors have no session to refresh, and the
      // navigation that follows a prefetch refreshes the session itself.
      has: [{ type: "header", key: "cookie", value: ".*sb-.+-auth-token.*" }],
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
