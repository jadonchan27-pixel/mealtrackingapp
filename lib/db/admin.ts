// Supabase client with the service role key. Bypasses row-level security, so use it
// only on the server for work that isn't tied to a request (e.g. seeding).

import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseServiceRoleKey, supabaseUrl } from "./env";
import type { Database } from "./types";

export function createAdminClient() {
  return createSupabaseClient<Database>(
    supabaseUrl(),
    supabaseServiceRoleKey(),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
