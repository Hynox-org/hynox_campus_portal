import { createBrowserClient } from "@supabase/ssr";
import { SHARED_ROLE_COOKIE, SHARED_ROLE_HEADER } from "@/lib/shared-login";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          const role = typeof document === "undefined" ? undefined : document.cookie.split("; ").find(c => c.startsWith(`${SHARED_ROLE_COOKIE}=`))?.split("=").slice(1).join("=");
          headers.set(SHARED_ROLE_HEADER, role ? decodeURIComponent(role) : "");
          return fetch(input, { ...init, headers });
        },
      },
    }
  );
}
