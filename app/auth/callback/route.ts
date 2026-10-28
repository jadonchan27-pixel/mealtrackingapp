// Google redirects here after sign-in. Exchanges the code for a session and
// refuses any account other than ALLOWED_EMAIL.

import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth/allowed";
import { createClient } from "@/lib/db/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const redirectTo = (path: string) =>
    NextResponse.redirect(new URL(path, request.url));

  if (!code) {
    return redirectTo("/sign-in?error=sign_in_failed");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return redirectTo("/sign-in?error=sign_in_failed");
  }
  if (!isAllowedEmail(data.user.email)) {
    await supabase.auth.signOut();
    return redirectTo("/sign-in?error=not_allowed");
  }
  return redirectTo("/");
}
