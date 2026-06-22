import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { isAllowedEmail, serverAuthClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

// Handles the magic-link return. Supports both PKCE (?code=) and the
// token_hash flow (?token_hash=&type=).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = serverAuthClient();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  }

  if (!ok) {
    return NextResponse.redirect(`${origin}/login?error=link_invalid`);
  }

  // Enforce the allowlist at sign-in too.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAllowedEmail(user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_allowed`);
  }

  return NextResponse.redirect(origin);
}
