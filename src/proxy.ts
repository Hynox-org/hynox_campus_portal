import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { supabase, supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Paths that can be accessed without logging in
  const publicPaths = ["/login", "/auth/callback", "/onboarding/verify"];
  
  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  if (!user) {
    // If not logged in and trying to access a protected page, redirect to login
    if (!isPublicPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // User is authenticated, resolve their role
  let role = "public";
  
  // Phase 8 Rule: Ensure akshaykumar07.m@gmail.com is always super_admin
  if (user.email === "akshaykumar07.m@gmail.com") {
    role = "super_admin";
  } else {
    // Resolve user from core.users and core.user_roles dynamically
    let { data: dbUser } = await supabase
      .schema("core")
      .from("users")
      .select("id")
      .eq("auth_user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!dbUser && user.email) {
      // Fallback to query by email in case the auth link isn't established yet
      const { data: emailUser } = await supabase
        .schema("core")
        .from("users")
        .select("id")
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
    const url = request.nextUrl.clone();
    url.pathname = myDashboard;
    return NextResponse.redirect(url);
  }

  // Enforce route protection by role dashboards
  if (pathname.startsWith("/admin") && role !== "super_admin") {
    const url = request.nextUrl.clone();
    url.pathname = myDashboard;
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/institution") && role !== "institution_admin") {
    const url = request.nextUrl.clone();
    url.pathname = myDashboard;
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/teacher") && role !== "teacher" && role !== "trainer") {
    const url = request.nextUrl.clone();
    url.pathname = myDashboard;
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/student") && role !== "student") {
    const url = request.nextUrl.clone();
    url.pathname = myDashboard;
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/public") && role !== "public" && role !== "mentor") {
    const url = request.nextUrl.clone();
    url.pathname = myDashboard;
    return NextResponse.redirect(url);
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
