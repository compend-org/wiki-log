import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
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
// Next.js reads these values at build time, so they are written out in full.
export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      has: [{ type: "cookie", key: "sb-quvdheoxedxnutgplhbn-auth-token" }],
    },
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      has: [{ type: "cookie", key: "sb-quvdheoxedxnutgplhbn-auth-token.0" }],
    },
  ],
};