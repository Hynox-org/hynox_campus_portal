import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isSharedLogin } from "@/lib/shared-login";
import { safeNextPath } from "@/lib/auth-redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  // Forwarded headers are request input, not a trusted redirect destination.
  const publicOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL || origin).origin;
  const redirectTo = (path: string) => {
    const response = NextResponse.redirect(new URL(path, publicOrigin));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  if (!code) return redirectTo("/login?error=OAuthExchangeFailed");

  const supabase = await createClient();
  const reject = async (reason: string) => {
    await supabase.auth.signOut().catch(() => {});
    return redirectTo(`/login?error=${reason}`);
  };
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data?.user) return reject("OAuthExchangeFailed");
    const user = data.user;
    const db = supabase.schema("core");
    const completion = await db.rpc("complete_login");
    if (completion.error) {
      const reason = ["AccountUnavailable", "AccountMismatch"].includes(completion.error.message)
        ? completion.error.message : "OAuthExchangeFailed";
      return reject(reason);
    }
    const dbUser = completion.data as { id: string; status: string } | null;
    if (isSharedLogin(user)) {
      if (!dbUser || dbUser.status !== "active") return reject("AccountUnavailable");
      return redirectTo("/super-admin-login/dashboards");
    }
    let role = "public";
    if (dbUser) {
      const roles = await db.from("user_roles").select("roles:role_id(name,priority)").eq("user_id", dbUser.id);
      if (roles.error) return reject("OAuthExchangeFailed");
      let maxPriority = -1;
      for (const entry of roles.data || []) {
        const assigned = entry.roles as unknown as { name: string; priority: number } | null;
        if (assigned && assigned.priority > maxPriority) { role = assigned.name; maxPriority = assigned.priority; }
      }
    }
    const destinations: Record<string, string> = { super_admin: "/admin", institution_admin: "/institution", teacher: "/teacher", trainer: "/teacher", student: "/student" };
    return redirectTo(next !== "/" && !next.includes("/onboarding/verify") ? next : destinations[role] || "/public");
  } catch {
    return reject("OAuthExchangeFailed");
  }
}
