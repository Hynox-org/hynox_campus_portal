import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
vi.mock("@/utils/supabase/middleware", () => ({ updateSession: vi.fn() }));
import { updateSession } from "@/utils/supabase/middleware";
import { proxy } from "./proxy";

describe("shared dashboard route protection", () => {
  let user: { id: string; app_metadata: Record<string, unknown> } | null;
  let status: string;
  let assignedRoles: string[];
  beforeEach(() => {
    user = { id: "auth-1", app_metadata: { shared_dashboard_login: true } };
    status = "active";
    assignedRoles = ["super_admin", "student", "teacher", "institution_admin"];
    vi.mocked(updateSession).mockImplementation(async request => {
      const supabaseResponse = NextResponse.next({ request });
      supabaseResponse.cookies.set("refreshed-session", "present");
      const supabase = { auth: { signOut: vi.fn() }, schema: () => ({ from: (table: string) => {
        const data = table === "users" ? { id: "user-1", status } : assignedRoles.map(name => ({ roles: { name, priority: name === "super_admin" ? 100 : 10 } }));
        const query = { select: () => query, eq: () => query, is: () => query, maybeSingle: async () => ({ data }), then: (resolve: (value: unknown) => unknown) => resolve({ data }) };
        return query;
      } }) };
      return { user, supabase, supabaseResponse } as never;
    });
  });
  const request = (path: string, role?: string) => new NextRequest(`http://localhost:3000${path}`, role ? { headers: { cookie: `campus-dashboard-role=${role}` } } : undefined);
  it("allows the separate login without authentication", async () => {
    user = null;
    expect((await proxy(request("/super-admin-login"))).headers.get("location")).toBeNull();
    expect((await proxy(request("/student"))).headers.get("location")).toBe("http://localhost:3000/login");
  });
  it("requires dashboard selection before opening protected pages", async () => {
    const result = await proxy(request("/admin"));
    expect(result.headers.get("location")).toBe("http://localhost:3000/super-admin-login/dashboards");
    expect(result.cookies.get("refreshed-session")?.value).toBe("present");
  });
  it("uses the chosen role instead of the highest assigned role", async () => {
    expect((await proxy(request("/student", "auth-1:student"))).headers.get("location")).toBeNull();
    expect((await proxy(request("/admin", "auth-1:student"))).headers.get("location")).toBe("http://localhost:3000/student");
  });
  it("rejects role cookies belonging to another identity", async () => {
    expect((await proxy(request("/admin", "auth-2:super_admin"))).headers.get("location")).toBe("http://localhost:3000/super-admin-login/dashboards");
  });
  it("rejects suspended shared accounts", async () => {
    status = "suspended";
    expect((await proxy(request("/admin", "auth-1:super_admin"))).headers.get("location")).toBe("http://localhost:3000/super-admin-login");
  });
  it("keeps normal accounts on their existing dashboard", async () => {
    user = { id: "auth-1", app_metadata: {} };
    expect((await proxy(request("/login", "auth-1:student"))).headers.get("location")).toBe("http://localhost:3000/admin");
  });
  it("rejects linked users whose roles are no longer visible", async () => {
    user = { id: "auth-1", app_metadata: {} }; assignedRoles = [];
    expect((await proxy(request("/admin"))).headers.get("location")).toBe("http://localhost:3000/login?error=AccountUnavailable");
    expect((await proxy(request("/login"))).headers.get("location")).toBeNull();
  });
  it.each(["invited", "inactive", "suspended"])("denies %s ordinary accounts", async accountStatus => {
    user = { id: "auth-1", app_metadata: {} }; status = accountStatus;
    expect((await proxy(request("/admin"))).headers.get("location")).toBe("http://localhost:3000/login?error=AccountUnavailable");
  });
  it("allows Admin to open the Teacher workspace as its page permits", async () => {
    user = { id: "auth-1", app_metadata: {} };
    expect((await proxy(request("/teacher"))).headers.get("location")).toBeNull();
  });

  it.each([["super_admin", "/admin"], ["institution_admin", "/institution"], ["teacher", "/teacher"], ["trainer", "/teacher"], ["student", "/student"], ["public", "/public"], ["mentor", "/public"]])("enforces the %s dashboard boundary", async (name, dashboard) => {
    user = { id: "auth-1", app_metadata: {} }; assignedRoles = [name];
    expect((await proxy(request(dashboard))).headers.get("location")).toBeNull();
    if (name !== "super_admin") expect((await proxy(request("/admin?tab=institutions"))).headers.get("location")).toBe(`http://localhost:3000${dashboard}`);
  });
  it("forwards refreshed cookies and disables shared caching on protected responses", async () => {
    const result = await proxy(request("/student", "auth-1:student"));
    expect(result.cookies.get("refreshed-session")?.value).toBe("present");
    expect(result.headers.get("cache-control")).toBe("private, no-store");
  });
  it("does not query roles before the OAuth callback handles account linking", async () => {
    expect((await proxy(request("/auth/callback?code=valid"))).headers.get("location")).toBeNull();
  });

});
