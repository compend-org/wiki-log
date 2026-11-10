import { type NextRequest, NextResponse } from "next/server";
import { adminOnly, isAdminPath, updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (isAdminPath(request.nextUrl.pathname)) return await adminOnly(request);

  // Safety net: visitors with no Supabase ("sb-") cookie have no session
  const hasSession = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-"));
  if (!hasSession) return NextResponse.next();

  return await updateSession(request);
}

// The proxy only runs for visitors who have a session cookie, so signed-out
// visitors (and the pages and prefetches they load) don't invoke it at all.
// The cookie is split into pieces when it is long, hence two entries.
// Analytics requests forwarded to PostHog (/ingest) don't need a session.
// The admin pages are the exception: they have to answer signed-out visitors
// with a 404 too, so the proxy always runs for them.
// Next.js reads these values at build time, so they are written out in full.
export const config = {
  matcher: [
    "/admin/:path*",
    {
      source:
        "/((?!_next/static|_next/image|ingest|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      has: [{ type: "cookie", key: "sb-quvdheoxedxnutgplhbn-auth-token" }],
    },
    {
      source:
        "/((?!_next/static|_next/image|ingest|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      has: [{ type: "cookie", key: "sb-quvdheoxedxnutgplhbn-auth-token.0" }],
    },
  ],
};
