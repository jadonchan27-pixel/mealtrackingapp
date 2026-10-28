// Decides what the proxy does with a request, based on the path and who is signed in.

import { isAllowedEmail } from "./allowed";

export type Access =
  | "allow"
  | "sign-in" // redirect to the sign-in page
  | "home" // already signed in; redirect away from the sign-in page
  | "refuse" // a different Google account: sign it out
  | "unauthorized" // API request with no session
  | "forbidden"; // API request from a different account

export const SIGN_IN_PATH = "/sign-in";

// Paths that must work while signed out.
const PUBLIC_PATHS = [SIGN_IN_PATH, "/auth/callback", "/auth/sign-out"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}

function isApi(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

export function decideAccess(
  pathname: string,
  email: string | null | undefined,
): Access {
  const signedIn = Boolean(email);
  const allowed = isAllowedEmail(email);

  if (signedIn && !allowed) {
    return isApi(pathname) ? "forbidden" : "refuse";
  }
  if (pathname === SIGN_IN_PATH) {
    return signedIn ? "home" : "allow";
  }
  if (isPublic(pathname) || signedIn) {
    return "allow";
  }
  return isApi(pathname) ? "unauthorized" : "sign-in";
}
