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
});
