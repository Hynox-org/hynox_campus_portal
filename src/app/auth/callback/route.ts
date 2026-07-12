import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const host = request.headers.get("x-forwarded-host");
  let proto = request.headers.get("x-forwarded-proto") || "https";
  if (host && (host.includes("localhost") || host.includes("127.0.0.1"))) {
    proto = "http";
  }
  const publicOrigin = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || origin);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";

  if (code) {
    const supabase = await createClient();
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && sessionData?.user) {
      const user = sessionData.user;

      // 1. Resolve business user from core.users (by auth_user_id or email)
      let { data: dbUser } = await supabase
        .schema("core")
        .from("users")
        .select("id, email, auth_user_id")
        .eq("auth_user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();

      if (!dbUser && user.email) {
        const { data: emailUser } = await supabase
          .schema("core")
          .from("users")
          .select("id, email, auth_user_id")
          .eq("email", user.email)
          .is("deleted_at", null)
          .maybeSingle();
        
        if (emailUser) {
          dbUser = emailUser;
        }
      }

      // If user is pre-provisioned but not linked yet, run the link flow
      if (dbUser) {
        if (!dbUser.auth_user_id) {
          // Link Google Auth ID to pre-provisioned core.users
          await supabase
            .schema("core")
            .from("users")
            .update({
              auth_user_id: user.id,
              status: "active"
            })
            .eq("id", dbUser.id);
          
          // Accept pending invitations
          await supabase
            .schema("core")
            .from("user_invitations")
            .update({
              status: "accepted",
              accepted_at: new Date().toISOString()
            })
            .eq("user_id", dbUser.id)
            .in("status", ["created", "sent", "pending"]);

          // Refresh JWT claims
          await supabase
            .schema("core")
            .rpc("set_user_role_claim", { target_user_id: user.id });
        }
      } else {
        // If user is not found, double check if trigger created them
        const { data: triggerUser } = await supabase
          .schema("core")
          .from("users")
          .select("id, email, auth_user_id")
          .eq("auth_user_id", user.id)
          .is("deleted_at", null)
          .maybeSingle();
        
        if (triggerUser) {
          dbUser = triggerUser;
        }
      }

      // 2. Resolve primary role
      let role = "public";
      
      // Phase 8 / Requirement 8 check: akshaykumar07.m@gmail.com is always super_admin
      if (user.email === "akshaykumar07.m@gmail.com") {
        role = "super_admin";
      } else if (dbUser) {
        const { data: userRoles } = await supabase
          .schema("core")
          .from("user_roles")
          .select(`
            role_id,
            roles:role_id (
              name,
              priority
            )
          `)
          .eq("user_id", dbUser.id);

        if (userRoles && userRoles.length > 0) {
          let maxPriority = -1;
          userRoles.forEach((ur: any) => {
            const r = ur.roles as any;
            if (r && r.priority > maxPriority) {
              maxPriority = r.priority;
              role = r.name;
            }
          });
        }
      }

      // 3. Determine redirect dashboard destination
      const dashboardRoutes: Record<string, string> = {
        super_admin: "/admin",
        institution_admin: "/institution",
        teacher: "/teacher",
        trainer: "/teacher",
        student: "/student",
      };

      const defaultDest = dashboardRoutes[role] || "/public";

      // If next is root or points to onboarding, bypass onboarding verify screen
      let finalDest = defaultDest;
      if (next && next !== "/" && !next.includes("/onboarding/verify")) {
        finalDest = next;
      }

      const forwardUrl = finalDest.startsWith("/") ? `${publicOrigin}${finalDest}` : finalDest;
      return NextResponse.redirect(forwardUrl);
    }
  }

  // Fallback if exchange fails
  return NextResponse.redirect(`${publicOrigin}/login?error=OAuthExchangeFailed`);
}
