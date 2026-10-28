// Runs before every page and API request (except static files).
// Signed-out users are sent to sign-in; any account other than ALLOWED_EMAIL is signed out.

import { NextResponse, type NextRequest } from "next/server";
import { decideAccess, SIGN_IN_PATH } from "@/lib/auth/access";
import { updateSession } from "@/lib/db/proxy";

export async function proxy(request: NextRequest) {
  const { supabase, user, response } = await updateSession(request);
  const access = decideAccess(request.nextUrl.pathname, user?.email);

  switch (access) {
    case "allow":
      return response();
    case "sign-in":
      return withSession(redirect(request, SIGN_IN_PATH), response());
    case "home":
      return withSession(redirect(request, "/"), response());
    case "refuse":
      await supabase.auth.signOut();
      return withSession(
        redirect(request, `${SIGN_IN_PATH}?error=not_allowed`),
        response(),
      );
    case "unauthorized":
      return withSession(json(401, "Not signed in"), response());
    case "forbidden":
      await supabase.auth.signOut();
      return withSession(json(403, "This account isn't allowed"), response());
  }
}

function redirect(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

function json(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

// Copies refreshed or cleared session cookies and their no-cache headers onto a new response.
function withSession(target: NextResponse, session: NextResponse) {
  for (const cookie of session.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  for (const key of ["cache-control", "expires", "pragma"]) {
    const value = session.headers.get(key);
    if (value) {
      target.headers.set(key, value);
    }
  }
  return target;
}

export const config = {
  matcher: [
    // Everything except Next.js internals and files with an extension (icons, images).
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|webmanifest)$).*)",
  ],
};
