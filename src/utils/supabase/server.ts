import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SHARED_ROLE_COOKIE, SHARED_ROLE_HEADER } from "@/lib/shared-login";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { [SHARED_ROLE_HEADER]: cookieStore.get(SHARED_ROLE_COOKIE)?.value || "" } },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored when called from Server Components during rendering
          }
        },
      },
    }
  );
}
