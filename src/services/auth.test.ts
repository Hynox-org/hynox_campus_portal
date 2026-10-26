import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "./auth";

describe("server identity resolution", () => {
  const update = vi.fn();
  const getUser = vi.fn();
  let businessUser: { id: string; auth_user_id: string | null; tenant_id: string | null; status: string } | null;
  let userError: object | null;
  let rolesError: object | null;
  let roles: Array<{ roles: { name: string; priority: number } }>;
  let institutionStatus: string;
  let institutionError: object | null;
  let authUser: { id: string; email: string; app_metadata: Record<string, unknown> };
  let from: ReturnType<typeof vi.fn>;
  let selected: string | undefined;
  beforeEach(() => {
    vi.clearAllMocks();
    businessUser = { id: "student-1", auth_user_id: "auth-1", tenant_id: "campus-1", status: "active" };
    authUser = { id: "auth-1", email: "student@example.com", app_metadata: {} };
    userError = null; rolesError = null; selected = undefined;
    institutionStatus = "active"; institutionError = null;
    getUser.mockImplementation(async () => ({ data: { user: authUser }, error: null }));
    roles = [{ roles: { name: "student", priority: 10 } }, { roles: { name: "teacher", priority: 20 } }];
    from = vi.fn((table: string) => {
      const data = table === "users" ? businessUser : table === "user_roles" ? roles : { id: "campus-1", status: institutionStatus };
      const result = { data, error: table === "users" ? userError : table === "user_roles" ? rolesError : institutionError };
      const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), update, maybeSingle: vi.fn(async () => result), then: (resolve: (value: unknown) => void) => resolve(result) };
      update.mockReturnValue(query);
      return query;
    });
    vi.mocked(createClient).mockResolvedValue({ auth: { getUser }, schema: () => ({ from }) } as never);
    vi.mocked(cookies).mockResolvedValue({ get: () => selected ? { value: selected } : undefined } as never);
  });
  it("selects the highest server-stored role and tenant", async () => {
    expect(await getCurrentUser()).toMatchObject({ primaryRole: "teacher", tenantId: "campus-1", user: { id: "student-1" } });
  });
  it.each(["invited", "inactive", "suspended", "deleted"])("denies %s accounts without mutating them", async status => {
    businessUser!.status = status;
    expect(await getCurrentUser()).toBeNull(); expect(update).not.toHaveBeenCalled();
  });
  it("does not relink an account already owned by another identity", async () => {
    businessUser!.auth_user_id = "someone-else";
    expect(await getCurrentUser()).toBeNull(); expect(update).not.toHaveBeenCalled();
  });
  it("does not activate an unlinked account while reading the session", async () => {
    businessUser!.auth_user_id = null;
    expect(await getCurrentUser()).toBeNull(); expect(update).not.toHaveBeenCalled();
  });
  it("allows an authenticated unprovisioned account only the public hub", async () => {
    businessUser = null;
    expect(await getCurrentUser()).toMatchObject({ user: null, primaryRole: "public", tenantId: null });
    expect(from.mock.calls.filter(([table]) => table === "users")).toHaveLength(1);
  });
  it("fails closed on a database error", async () => {
    userError = { message: "private database details" }; expect(await getCurrentUser()).toBeNull();
  });
  it("fails closed on role lookup failure", async () => {
    rolesError = { message: "private role details" }; expect(await getCurrentUser()).toBeNull();
  });
  it("fails closed when a linked account has no visible roles", async () => {
    roles = []; expect(await getCurrentUser()).toBeNull();
  });
  it.each(["inactive", "suspended"])("denies a %s campus to ordinary members", async status => {
    institutionStatus = status; expect(await getCurrentUser()).toBeNull();
  });
  it("fails closed when institution lookup fails", async () => {
    institutionError = { message: "unavailable" }; expect(await getCurrentUser()).toBeNull();
  });
  it("uses only assigned shared roles for the current identity", async () => {
    authUser.app_metadata.shared_dashboard_login = true; selected = "auth-1:student";
    expect(await getCurrentUser()).toMatchObject({ primaryRole: "student", sharedLogin: true });
    selected = "auth-2:teacher";
    expect(await getCurrentUser()).toMatchObject({ primaryRole: "public" });
  });
  it("ignores a role-selection cookie for ordinary users", async () => {
    selected = "auth-1:super_admin";
    expect(await getCurrentUser()).toMatchObject({ primaryRole: "teacher" });
  });
  it("does not read business records for an invalid auth session", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });
    expect(await getCurrentUser()).toBeNull(); expect(from).not.toHaveBeenCalled();
  });
});
