import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_USERS, type DemoRole } from "../lib/demo";

const mocks = vi.hoisted(() => ({
  role: "student",
  cookieRole: "teacher",
  authGetUser: vi.fn(),
  schema: vi.fn(),
  unavailable: false,
  wrongRole: false,
}));

vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-hynox-demo-role": mocks.role }),
  cookies: async () => ({ get: (name: string) => name === "hynox-demo-role" ? { value: mocks.cookieRole } : undefined }),
}));
vi.mock("@/utils/supabase/server", () => ({ createClient: async () => ({ schema: mocks.schema, auth: { getUser: mocks.authGetUser } }) }));

import { getCurrentUser } from "./auth";
import { getSessionTenant, createProgram } from "./academic";

let inserted: Record<string, unknown> | undefined;

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "true");
  mocks.role = "student";
  mocks.unavailable = false;
  mocks.wrongRole = false;
  inserted = undefined;
  mocks.schema.mockImplementation(() => ({ from: (table: string) => {
    const query = {
      select: () => query,
      eq: vi.fn(() => query),
      is: () => query,
      insert: (input: Record<string, unknown>) => { inserted = input; return query; },
      maybeSingle: async () => ({ data: mocks.unavailable ? null : { id: DEMO_USERS[mocks.role as DemoRole], email: "demo@example.test", tenant_id: "campus-id", status: "active" }, error: null }),
      single: async () => ({ data: table === "institutions" ? { id: "campus-id" } : { id: "program-id", ...inserted }, error: null }),
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: [{ roles: { name: mocks.wrongRole ? "public" : mocks.role } }], error: null }).then(resolve),
    };
    return query;
  } }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("demo business identity", () => {
  it.each(Object.keys(DEMO_USERS) as DemoRole[])("resolves the existing %s without calling Supabase Auth", async (role) => {
    mocks.role = role;
    const user = await getCurrentUser();
    expect(user?.user.id).toBe(DEMO_USERS[role]);
    expect(user?.primaryRole).toBe(role);
    expect(mocks.authGetUser).not.toHaveBeenCalled();
  });

  it("passes the selected business user and tenant to academic operations without the auth RPC", async () => {
    mocks.role = "institution_admin";
    expect(await getSessionTenant()).toEqual({ tenantId: "campus-id", userId: DEMO_USERS.institution_admin, roles: ["institution_admin"] });
    await createProgram({ title: "Demo program", slug: "demo-program" });
    expect(inserted).toMatchObject({ tenant_id: "campus-id", institution_id: "campus-id", created_by: DEMO_USERS.institution_admin, updated_by: DEMO_USERS.institution_admin });
    expect(mocks.authGetUser).not.toHaveBeenCalled();
  });

  it("reports unavailable demo users instead of changing their records", async () => {
    mocks.unavailable = true;
    await expect(getCurrentUser()).rejects.toThrow("Demo student profile is unavailable");
    expect(inserted).toBeUndefined();
  });

  it("rejects a demo user whose configured role was removed", async () => {
    mocks.wrongRole = true;
    await expect(getCurrentUser()).rejects.toThrow("does not have the student role");
  });
});
