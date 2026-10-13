import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { isSharedLogin, selectedSharedRole, SHARED_ROLE_COOKIE } from "@/lib/shared-login";

export async function proxy(request: NextRequest) {
  const { supabase, supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Paths that can be accessed without logging in
  const publicPaths = ["/login", "/super-admin-login", "/auth/callback", "/onboarding/verify"];
  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie));
    return response;
  };
  
  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  if (!user) {
    // If not logged in and trying to access a protected page, redirect to login
    if (!isPublicPath) {
      return redirectTo(pathname.startsWith("/super-admin-login") ? "/super-admin-login" : "/login");
    }
    return supabaseResponse;
  }

  // User is authenticated, resolve their role
  let role = "public";
  let assignedRoles: string[] = [];
  
  // Resolve user from core.users and core.user_roles dynamically
  let { data: dbUser } = await supabase
    .schema("core")
    .from("users")
    .select("id, status")
    .eq("auth_user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!dbUser && user.email) {
    // Fallback to query by email in case the auth link isn't established yet
    const { data: emailUser } = await supabase
      .schema("core")
      .from("users")
      .select("id, status")
      .eq("email", user.email)
      .is("deleted_at", null)
      .maybeSingle();

    if (emailUser) {
      dbUser = emailUser;
    }
  }

  if (dbUser) {
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
      const roles = userRoles.map(ur => ur.roles as unknown as { name: string; priority: number } | null);
      assignedRoles = roles.flatMap(r => r?.name ? [r.name] : []);
      let maxPriority = -1;
      roles.forEach(r => {
        if (r && r.priority > maxPriority) {
          maxPriority = r.priority;
          role = r.name;
        }
      });
    }
  }

  if (isSharedLogin(user)) {
    if (!dbUser || dbUser.status !== "active") {
      await supabase.auth.signOut();
      return redirectTo("/super-admin-login");
    }
    const selected = selectedSharedRole(request.cookies.get(SHARED_ROLE_COOKIE)?.value, user.id, assignedRoles);
    if (pathname === "/super-admin-login") return redirectTo("/super-admin-login/dashboards");
    if (!selected && !pathname.startsWith("/super-admin-login/") && pathname !== "/auth/callback") {
      return redirectTo("/super-admin-login/dashboards");
    }
    role = selected || "public";
  } else if (pathname.startsWith("/super-admin-login/dashboards")) {
    return redirectTo("/login");
  }

  // Define dashboard URLs
  const dashboardRoutes: Record<string, string> = {
    super_admin: "/admin",
    institution_admin: "/institution",
    teacher: "/teacher",
    trainer: "/teacher",
    mentor: "/public",
    student: "/student",
    public: "/public",
  };

  const myDashboard = dashboardRoutes[role] || "/public";

  // Prevent authenticated users from going back to login or root landing page '/'
  if (pathname === "/login" || pathname === "/") {
    return redirectTo(myDashboard);
  }

  // Enforce route protection by role dashboards
  if (pathname.startsWith("/admin") && role !== "super_admin") {
    return redirectTo(myDashboard);
  }

  if (pathname.startsWith("/institution") && role !== "institution_admin") {
    return redirectTo(myDashboard);
  }

  if (pathname.startsWith("/teacher") && role !== "teacher" && role !== "trainer") {
    return redirectTo(myDashboard);
  }

  if (pathname.startsWith("/student") && role !== "student") {
    return redirectTo(myDashboard);
  }

  if (pathname.startsWith("/public") && role !== "public" && role !== "mentor") {
    return redirectTo(myDashboard);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images, vector logos (.svg, .png, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
