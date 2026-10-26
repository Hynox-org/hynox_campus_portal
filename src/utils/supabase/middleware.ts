import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SHARED_ROLE_COOKIE, SHARED_ROLE_HEADER } from "@/lib/shared-login";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { [SHARED_ROLE_HEADER]: request.cookies.get(SHARED_ROLE_COOKIE)?.value || "" } },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          const previousCookies = supabaseResponse.cookies.getAll();
          supabaseResponse = NextResponse.next({
            request,
          });
          previousCookies.forEach(cookie => supabaseResponse.cookies.set(cookie));
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired
  const {
    data: { user }, error,
  } = await supabase.auth.getUser();

  return { supabase, supabaseResponse, user: error ? null : user };
}
