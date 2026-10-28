// Supabase client for Server Components, Server Functions and Route Handlers.
// Acts as the signed-in user, so row-level security applies.

import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "./env";
import type { Database } from "./types";

export async function createClient() {
  // Supabase checks token expiry with Date.now(), which Cache Components refuses
  // while prerendering, so render anything using this client only at request time.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. The auth middleware (build step 3)
          // refreshes the session instead.
        }
      },
    },
  });
}
