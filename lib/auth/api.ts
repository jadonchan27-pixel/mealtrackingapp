// Guard for API route handlers. Checks the session again rather than relying on
// the proxy alone, so a route stays protected if the proxy matcher ever changes.
//
//   const auth = await requireUser();
//   if (!auth.ok) return auth.response;
//   const { user, supabase } = auth;

import "server-only";
import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { isAllowedEmail } from "./allowed";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type RequireUserResult =
  | { ok: true; user: User; supabase: Supabase }
  | { ok: false; response: NextResponse };

export async function requireUser(): Promise<RequireUserResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not signed in" }, { status: 401 }),
    };
  }
  if (!isAllowedEmail(user.email)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "This account isn't allowed" },
        { status: 403 },
      ),
    };
  }
  return { ok: true, user, supabase };
}
