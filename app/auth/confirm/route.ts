import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { safeNext } from "@/lib/redirect";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// The link in the email may carry a full address (the page to return to) or a
// plain path. Either way, only paths on this site are followed.
function nextPath(value: string | null, origin: string): string {
  if (!value) return "/";
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return "/";
    return safeNext(url.pathname);
  } catch {
    return "/";
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = nextPath(searchParams.get("next"), origin);

  if (tokenHash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      // Following an emailed link proves the person owns the address
      if (data.user) {
        const { error: recordError } = await createAdminClient()
          .from("email_verifications")
          .upsert({ user_id: data.user.id }, { ignoreDuplicates: true });
        if (recordError) console.error(recordError);
      }
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/auth/error", origin));
}
