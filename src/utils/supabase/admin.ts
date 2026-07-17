import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Uses the service role key to perform privileged operations (e.g. deleting
// a user from auth.users) that the anon/user-scoped client cannot do.
// Never expose this client or the service role key to the browser.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Set it in your environment to enable admin operations."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
